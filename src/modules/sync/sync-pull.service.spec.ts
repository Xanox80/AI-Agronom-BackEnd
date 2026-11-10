import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity, ObservationEntity, PhotoEntity, RecommendationEntity,
  SyncRecordEntity, TaskEntity, TreatmentEntity,
} from '../../domain/entities';
import { DiagnosisPass, ObservationStatus, Role, SyncOperation, SyncStatus, TaskType } from '../../domain/enums';
import { actorOf, fakeConfig, openTestDatabase, testSyncSettings } from './__fixtures__/test-database';
import { SyncPullService } from './sync-pull.service';

const MORE_THAN_ONE_SECOND = 1100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SyncPullService', () => {
  let db: DataSource;
  let service: SyncPullService;
  const farmId = randomUUID();
  const scout = actorOf(farmId);

  beforeEach(async () => {
    db = await openTestDatabase();
    service = new SyncPullService(
      fakeConfig(), testSyncSettings(), db.getRepository(FieldEntity), db.getRepository(TaskEntity), db.getRepository(TreatmentEntity),
      db.getRepository(ObservationEntity), db.getRepository(PhotoEntity), db.getRepository(DiagnosisResultEntity),
      db.getRepository(DiagnosisHypothesisEntity), db.getRepository(RecommendationEntity), db.getRepository(SyncRecordEntity),
    );
  });

  afterEach(() => db.destroy());

  const saveObservation = (farm = farmId) => {
    const repo = db.getRepository(ObservationEntity);
    return repo.save(repo.create({
      clientId: randomUUID(), farmId: farm, userId: scout.userId, capturedAt: new Date(), status: ObservationStatus.Synced,
    }));
  };

  const saveTask = (overrides: Partial<TaskEntity>) => {
    const repo = db.getRepository(TaskEntity);
    return repo.save(repo.create({
      clientId: randomUUID(), farmId, type: TaskType.Treatment, fieldId: randomUUID(), photoIds: [], createdByUserId: randomUUID(),
      title: 'Spray', ...overrides,
    }));
  };

  it('returns everything for a full pull and only the caller farm', async () => {
    const mine = await saveObservation();
    await saveObservation(randomUUID());

    const { changes } = await service.pull(scout, 'd1');

    expect(changes.observations).toHaveLength(1);
    expect(changes.observations[0]).toMatchObject({ id: mine.id, status: ObservationStatus.Synced, photos: [] });
  });

  it('returns only rows changed after the cursor', async () => {
    await saveObservation();
    await sleep(MORE_THAN_ONE_SECOND);
    const first = await service.pull(scout, 'd1');
    await sleep(MORE_THAN_ONE_SECOND);
    const later = await saveObservation();

    const second = await service.pull(scout, 'd1', first.serverTime);

    expect(second.changes.observations.map((o) => (o as { id: string }).id)).toEqual([later.id]);
  });

  it('delivers the server-refined diagnosis with ranked hypotheses', async () => {
    const observation = await saveObservation();
    const resultRepo = db.getRepository(DiagnosisResultEntity);
    const result = await resultRepo.save(resultRepo.create({
      farmId, observationId: observation.id, pass: DiagnosisPass.ServerRefined, providerName: 'mock', modelVersion: 'm1',
      calibrationTemperature: 1.5, entropy: 0.2, clarifyingQuestions: [], answers: {}, rawResponse: {},
    }));
    const hypothesisRepo = db.getRepository(DiagnosisHypothesisEntity);
    await hypothesisRepo.save([
      hypothesisRepo.create({ diagnosisResultId: result.id, rank: 2, diagnosisCode: 'b', rawProbability: 0.2, probability: 0.2 }),
      hypothesisRepo.create({ diagnosisResultId: result.id, rank: 1, diagnosisCode: 'a', rawProbability: 0.7, probability: 0.7 }),
    ]);

    const { changes } = await service.pull(scout, 'd1');

    const [diagnosis] = changes.diagnoses as { pass: string; hypotheses: { diagnosisCode: string }[] }[];
    expect(diagnosis.pass).toBe('server_refined');
    expect(diagnosis.hypotheses.map((h) => h.diagnosisCode)).toEqual(['a', 'b']);
  });

  it('limits a mechanic to tasks assigned to or created by them', async () => {
    const mechanic = actorOf(farmId, Role.Mechanic);
    const own = await saveTask({ assigneeUserId: mechanic.userId });
    await saveTask({ assigneeUserId: randomUUID() });

    const { changes } = await service.pull(mechanic, 'd1');

    expect((changes.tasks as { id: string }[]).map((t) => t.id)).toEqual([own.id]);
  });

  it('lists soft-deleted fields and applied sync deletions as deleted ids', async () => {
    const fieldRepo = db.getRepository(FieldEntity);
    const field = await fieldRepo.save(fieldRepo.create({ clientId: randomUUID(), farmId, name: 'F', deletedAt: new Date() }));
    const recordRepo = db.getRepository(SyncRecordEntity);
    const taskId = randomUUID();
    await recordRepo.save(recordRepo.create({
      farmId, userId: scout.userId, deviceId: 'd2', entityType: 'task', clientId: taskId, serverId: taskId,
      operation: SyncOperation.Delete, status: SyncStatus.Applied, clientTimestamp: new Date(), appliedAt: new Date(),
    }));

    const { changes, deleted } = await service.pull(scout, 'd1');

    expect(changes.fields).toEqual([]);
    expect(deleted).toEqual({ field: [field.id], task: [taskId] });
  });

  it('remembers the last pull time of a device', async () => {
    expect(await service.lastPullAt(farmId, 'd1')).toBeUndefined();

    await service.pull(scout, 'd1');

    expect(await service.lastPullAt(farmId, 'd1')).toBeInstanceOf(Date);
  });

  it('pages a large pull with a cursor and delivers every row exactly once', async () => {
    const paged = new SyncPullService(
      fakeConfig(), testSyncSettings(2), db.getRepository(FieldEntity), db.getRepository(TaskEntity), db.getRepository(TreatmentEntity),
      db.getRepository(ObservationEntity), db.getRepository(PhotoEntity), db.getRepository(DiagnosisResultEntity),
      db.getRepository(DiagnosisHypothesisEntity), db.getRepository(RecommendationEntity), db.getRepository(SyncRecordEntity),
    );
    const saved = await Promise.all([1, 2, 3, 4, 5].map(() => saveObservation()));
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const page = await paged.pull(scout, 'd1', undefined, cursor);
      seen.push(...(page.changes.observations as { id: string }[]).map((o) => o.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect([...seen].sort()).toEqual(saved.map((o) => o.id).sort());
  });

  it('rejects a malformed cursor', async () => {
    await expect(service.pull(scout, 'd1', undefined, 'garbage')).rejects.toThrow(/invalid pull cursor/);
  });
});
