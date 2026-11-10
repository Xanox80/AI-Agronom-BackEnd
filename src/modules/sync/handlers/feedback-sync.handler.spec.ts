import { randomUUID } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { DiagnosisHypothesisEntity, DiagnosisResultEntity, ObservationEntity } from '../../../domain/entities';
import { DiagnosisPass, ObservationStatus, SyncStatus } from '../../../domain/enums';
import { SKEW_MS, actorOf, openTestDatabase } from '../__fixtures__/test-database';
import { FeedbackSyncHandler } from './feedback-sync.handler';
import { SyncContext } from './entity-sync-handler';

describe('FeedbackSyncHandler', () => {
  let db: DataSource;
  let handler: FeedbackSyncHandler;
  let events: EventEmitter2;
  const farmId = randomUUID();
  const ctx: SyncContext = { ...actorOf(farmId), deviceId: 'd1', clockSkewMs: SKEW_MS };

  beforeEach(async () => {
    db = await openTestDatabase();
    events = new EventEmitter2();
    handler = new FeedbackSyncHandler(
      db.getRepository(ObservationEntity), db.getRepository(DiagnosisResultEntity),
      db.getRepository(DiagnosisHypothesisEntity), events,
    );
  });

  afterEach(() => db.destroy());

  const observation = () => {
    const repo = db.getRepository(ObservationEntity);
    return repo.save(repo.create({ clientId: randomUUID(), farmId, userId: ctx.userId, capturedAt: new Date() }));
  };

  const change = (observationId: string, finalDiagnosisId: string, at: string, correctedFromModel = false) => ({
    clientId: randomUUID(), clientTimestamp: new Date(at), payload: { observationId, finalDiagnosisId, correctedFromModel },
  });

  it('confirms the observation, emits the event and records the model top-1 on a correction', async () => {
    const o = await observation();
    const modelDiagnosisId = randomUUID();
    const results = db.getRepository(DiagnosisResultEntity);
    const result = await results.save(results.create({
      farmId, observationId: o.id, pass: DiagnosisPass.Initial, providerName: 'mock', modelVersion: 'm',
      calibrationTemperature: 1, entropy: 0, clarifyingQuestions: [], answers: {}, rawResponse: {},
    }));
    const hypotheses = db.getRepository(DiagnosisHypothesisEntity);
    await hypotheses.save(hypotheses.create({
      diagnosisResultId: result.id, rank: 1, diagnosisId: modelDiagnosisId, diagnosisCode: 'a', rawProbability: 1, probability: 1,
    }));
    const emitted: unknown[] = [];
    events.on('observation.confirmed', (e) => emitted.push(e));
    const finalId = randomUUID();

    const outcome = await handler.upsert(ctx, change(o.id, finalId, '2026-11-10T08:00:00Z', true));

    const saved = await db.getRepository(ObservationEntity).findOneByOrFail({ id: o.id });
    expect(outcome).toEqual({ status: SyncStatus.Applied, serverId: o.id });
    expect(saved).toMatchObject({ confirmedDiagnosisId: finalId, correctedFromDiagnosisId: modelDiagnosisId, status: ObservationStatus.Confirmed });
    expect(emitted).toEqual([expect.objectContaining({ diagnosisId: finalId, correctedFromDiagnosisId: modelDiagnosisId })]);
  });

  it('keeps a newer confirmation and reports a conflict for an older one', async () => {
    const o = await observation();
    const newer = randomUUID();
    await handler.upsert(ctx, change(o.id, newer, '2026-11-10T09:00:00Z'));

    const outcome = await handler.upsert(ctx, change(o.id, randomUUID(), '2026-11-10T08:00:00Z'));

    expect(outcome.status).toBe(SyncStatus.Conflict);
    expect((await db.getRepository(ObservationEntity).findOneByOrFail({ id: o.id })).confirmedDiagnosisId).toBe(newer);
  });

  it('rejects feedback for an observation of another farm', async () => {
    const repo = db.getRepository(ObservationEntity);
    const foreign = await repo.save(repo.create({ clientId: randomUUID(), farmId: randomUUID(), userId: randomUUID(), capturedAt: new Date() }));

    await expect(handler.upsert(ctx, change(foreign.id, randomUUID(), '2026-11-10T08:00:00Z'))).rejects.toThrow(/another farm/);
  });
});
