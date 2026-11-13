import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CatalogStateEntity, DiagnosisResultEntity, FarmEntity, ObservationEntity, PhotoEntity, SyncRecordEntity,
} from '../../domain/entities';
import { DiagnosisPass, SyncOperation, SyncStatus } from '../../domain/enums';
import { UnsureReason } from '../recognition/recognition.constants';
import { actorOf, createFarm, fakeConfig, openTestDatabase, syncSettings } from './__fixtures__/test-database';
import { SyncPullService } from './sync-pull.service';
import { SyncStatusService } from './sync-status.service';

describe('SyncStatusService', () => {
  let db: DataSource;
  let service: SyncStatusService;
  let farmId: string;

  beforeEach(async () => {
    db = await openTestDatabase();
    farmId = await createFarm(db);
    const pull = { lastPullAt: async () => undefined } as unknown as SyncPullService;
    service = new SyncStatusService(
      fakeConfig(), pull, db.getRepository(ObservationEntity), db.getRepository(SyncRecordEntity),
      db.getRepository(FarmEntity), db.getRepository(CatalogStateEntity),
    );
  });

  afterEach(() => db.destroy());

  const syncObservationWithPhoto = async () => {
    const observations = db.getRepository(ObservationEntity);
    const id = randomUUID();
    await observations.save(observations.create({ id, clientId: id, farmId, userId: randomUUID(), capturedAt: new Date() }));
    const records = db.getRepository(SyncRecordEntity);
    await records.save(records.create({
      farmId, userId: randomUUID(), deviceId: 'd1', entityType: 'observation', clientId: id, serverId: id,
      operation: SyncOperation.Upsert, status: SyncStatus.Applied, clientTimestamp: new Date(), appliedAt: new Date(),
    }));
    const photos = db.getRepository(PhotoEntity);
    await photos.save(photos.create({
      clientId: randomUUID(), farmId, observationId: id, seq: 1, storageKey: 'k', mimeType: 'image/jpeg', widthPx: 1, heightPx: 1,
      sizeBytes: 1, qualityReport: null, sha256: 'x',
    }));
    return id;
  };

  it('counts synced observations with photos that still lack a server-refined result', async () => {
    const refined = await syncObservationWithPhoto();
    await syncObservationWithPhoto();
    const results = db.getRepository(DiagnosisResultEntity);
    await results.save(results.create({
      farmId, observationId: refined, pass: DiagnosisPass.ServerRefined, providerName: 'mock', modelVersion: 'm',
      calibrationTemperature: 1, entropy: 0, clarifyingQuestions: [], answers: {}, rawResponse: {},
    }));

    const status = await service.status(actorOf(farmId), 'd1');

    expect(status.pendingRefinement).toBe(1);
    expect(status.lastPushAt).toEqual(expect.any(String));
  });

  it('still counts an observation whose server refinement ended in a provider failure', async () => {
    const failed = await syncObservationWithPhoto();
    const results = db.getRepository(DiagnosisResultEntity);
    await results.save(results.create({
      farmId, observationId: failed, pass: DiagnosisPass.ServerRefined, providerName: 'gemini', modelVersion: 'm',
      calibrationTemperature: 1, entropy: 1, unsure: true, unsureReason: UnsureReason.ProviderError,
      clarifyingQuestions: [], answers: {}, rawResponse: {},
    }));

    const status = await service.status(actorOf(farmId), 'd1');

    expect(status.pendingRefinement).toBe(1);
  });

  it('reports the catalogue version of the farm region and the client backoff settings', async () => {
    const states = db.getRepository(CatalogStateEntity);
    await states.save(states.create({ regionCode: 'UA-DEFAULT', version: 7, publishedAt: new Date(), lastVerifiedAt: new Date() }));

    const status = await service.status(actorOf(farmId), 'd1');

    expect(status.catalogVersion).toBe(7);
    expect(status.clientConfig).toEqual({
      backoffBaseMs: syncSettings.backoffBaseMs, backoffMaxMs: syncSettings.backoffMaxMs,
      backoffFactor: syncSettings.backoffFactor, batchSize: syncSettings.batchSize,
    });
  });
});
