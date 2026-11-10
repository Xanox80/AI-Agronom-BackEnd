import { randomUUID } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { FieldAccess } from '../tasks/field-access';
import { DataSource } from 'typeorm';
import {
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity, ObservationEntity, SyncRecordEntity, TaskEntity, TreatmentEntity,
  UserEntity,
} from '../../domain/entities';
import { ObservationStatus, Role, SyncEntityType, SyncOperation, SyncStatus, TaskType } from '../../domain/enums';
import { actorOf, fakeConfig, openTestDatabase, syncSettings, testSyncSettings } from './__fixtures__/test-database';
import { ObservationEnricher } from './enrichment/observation-enricher';
import { FieldGeometryService } from '../fields/field-geometry.service';
import { TreatmentsService } from '../tasks/treatments.service';
import { SyncItemDto } from './dto/push.dto';
import { FeedbackSyncHandler } from './handlers/feedback-sync.handler';
import { FieldSyncHandler } from './handlers/field-sync.handler';
import { ObservationSyncHandler } from './handlers/observation-sync.handler';
import { TaskSyncHandler } from './handlers/task-sync.handler';
import { TreatmentSyncHandler } from './handlers/treatment-sync.handler';
import { RefinementQueueService } from './refinement/refinement-queue.service';
import { SyncPushService } from './sync-push.service';

const FOREIGN_FIELD = randomUUID();
const DEVICE = 'device-1';
const T0 = '2026-11-10T08:00:00.000Z';
const T1 = '2026-11-10T09:00:00.000Z';

describe('SyncPushService', () => {
  let db: DataSource;
  let service: SyncPushService;
  let events: EventEmitter2;
  let scheduled: string[];
  let fieldAccess: FieldAccess;
  let recordedInputs: Record<string, unknown>[];
  const farmId = randomUUID();
  const scout = actorOf(farmId);

  beforeEach(async () => {
    db = await openTestDatabase();
    events = new EventEmitter2();
    scheduled = [];
    recordedInputs = [];
    const refinement = { scheduleWhenPhotosExist: async (id: string) => { scheduled.push(id); } } as unknown as RefinementQueueService;
    const locator = { locate: async () => ({ matches: [], nearby: [] }) } as never;
    const weather = { getCurrent: async () => { throw new Error('offline'); } } as never;
    const enricher = new ObservationEnricher(db.getRepository(UserEntity), locator, weather);
    const treatments = {
      record: async (_actor: unknown, input: Record<string, unknown>) => {
        recordedInputs.push(input);
        return db.getRepository(TreatmentEntity).create({
          id: input.clientId as string, clientId: input.clientId as string, farmId, fieldId: input.fieldId as string,
          productId: input.productId as string, activeSubstanceCodes: ['derived'], resistanceGroups: [], doseValue: 1, doseUnit: 'l/ha',
          treatedAreaHa: 1, appliedAt: '2026-11-10', recordedByUserId: scout.userId,
        });
      },
    } as unknown as TreatmentsService;
    fieldAccess = { require: async (_farm: string, fieldId: string) => { if (fieldId === FOREIGN_FIELD) throw new NotFoundException('Field not found'); } } as unknown as FieldAccess;
    const handlers = [
      new FieldSyncHandler(db.getRepository(FieldEntity), new FieldGeometryService()),
      new ObservationSyncHandler(db.getRepository(ObservationEntity), events, refinement, enricher, { remember: jest.fn() } as never, fieldAccess),
      new TaskSyncHandler(db.getRepository(TaskEntity), db.getRepository(UserEntity), fieldAccess, { validate: async () => undefined } as never),
      new TreatmentSyncHandler(db.getRepository(TreatmentEntity), treatments),
      new FeedbackSyncHandler(
        db.getRepository(ObservationEntity), db.getRepository(DiagnosisResultEntity), db.getRepository(DiagnosisHypothesisEntity), events,
      ),
    ];
    service = new SyncPushService(fakeConfig(), testSyncSettings(), db.getRepository(SyncRecordEntity), handlers);
  });

  afterEach(() => db.destroy());

  const observationItem = (clientId: string, overrides: Record<string, unknown> = {}, clientTimestamp = T0): SyncItemDto => ({
    entityType: SyncEntityType.Observation, clientId, operation: SyncOperation.Upsert, clientTimestamp,
    payload: { capturedAt: T0, textNote: 'rust spots', ...overrides },
  });

  const taskItem = (clientId: string, fieldId: string, title = 'Spray'): SyncItemDto => ({
    entityType: SyncEntityType.Task, clientId, operation: SyncOperation.Upsert, clientTimestamp: T0,
    payload: { type: TaskType.Treatment, fieldId, title },
  });

  it('creates an observation with the client id as server id and marks it synced', async () => {
    const clientId = randomUUID();
    const { results } = await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });

    expect(results).toEqual([{ clientId, entityType: 'observation', status: SyncStatus.Applied, serverId: clientId }]);
    const row = await db.getRepository(ObservationEntity).findOneByOrFail({ id: clientId });
    expect(row.status).toBe(ObservationStatus.Synced);
    expect(row.farmId).toBe(farmId);
    expect(scheduled).toEqual([clientId]);
  });

  it('rejects an observation that points at a field of another farm', async () => {
    const clientId = randomUUID();
    const { results } = await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId, { fieldId: FOREIGN_FIELD })] });

    expect(results[0].status).toBe(SyncStatus.Failed);
    expect(await db.getRepository(ObservationEntity).count()).toBe(0);
  });

  it('does not duplicate rows when the same batch is pushed twice', async () => {
    const batch = { deviceId: DEVICE, items: [observationItem(randomUUID())] };
    const created: string[] = [];
    events.on('observation.created', (e) => created.push(e.observationId));

    const first = await service.push(scout, batch);
    const second = await service.push(scout, batch);

    expect(second.results).toEqual(first.results);
    expect(await db.getRepository(ObservationEntity).count()).toBe(1);
    expect(await db.getRepository(SyncRecordEntity).count()).toBe(1);
    expect(created).toHaveLength(1);
  });

  it('applies a newer edit from the same device', async () => {
    const clientId = randomUUID();
    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });

    const { results } = await service.push(scout, {
      deviceId: DEVICE, items: [observationItem(clientId, { textNote: 'edited' }, T1)],
    });

    expect(results[0].status).toBe(SyncStatus.Applied);
    expect((await db.getRepository(ObservationEntity).findOneByOrFail({ id: clientId })).textNote).toBe('edited');
  });

  it('reports a conflict and keeps the server row when another device sends an older edit', async () => {
    const clientId = randomUUID();
    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });

    const { results } = await service.push(scout, {
      deviceId: 'device-2', items: [observationItem(clientId, { textNote: 'stale' }, '2020-01-01T00:00:00.000Z')],
    });

    expect(results[0]).toMatchObject({ status: SyncStatus.Conflict, serverId: clientId });
    expect((await db.getRepository(ObservationEntity).findOneByOrFail({ id: clientId })).textNote).toBe('rust spots');
  });

  it('never lets a sync edit overwrite the confirmed diagnosis', async () => {
    const clientId = randomUUID();
    const diagnosisId = randomUUID();
    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });
    await db.getRepository(ObservationEntity).update(clientId, { confirmedDiagnosisId: diagnosisId });

    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId, { textNote: 'edited' }, T1)] });

    expect((await db.getRepository(ObservationEntity).findOneByOrFail({ id: clientId })).confirmedDiagnosisId).toBe(diagnosisId);
  });

  it('applies fields before tasks that reference them regardless of item order', async () => {
    const fieldId = randomUUID();
    const taskId = randomUUID();
    const fieldItem: SyncItemDto = {
      entityType: SyncEntityType.Field, clientId: fieldId, operation: SyncOperation.Upsert, clientTimestamp: T0,
      payload: { name: 'North field' },
    };

    const { results } = await service.push(scout, { deviceId: DEVICE, items: [taskItem(taskId, fieldId), fieldItem] });

    expect(results.map((r) => r.entityType)).toEqual(['field', 'task']);
    expect(results.every((r) => r.status === SyncStatus.Applied)).toBe(true);
  });

  it('rejects a batch larger than the configured size', async () => {
    const items = Array.from({ length: syncSettings.batchSize + 1 }, () => observationItem(randomUUID()));

    await expect(service.push(scout, { deviceId: DEVICE, items })).rejects.toThrow(/at most 3 items/);
  });

  it('fails an item with an invalid payload without blocking the rest of the batch', async () => {
    const good = observationItem(randomUUID());
    const bad = observationItem(randomUUID(), { capturedAt: 'not-a-date' });

    const { results } = await service.push(scout, { deviceId: DEVICE, items: [bad, good] });

    expect(results[0]).toMatchObject({ status: SyncStatus.Failed, error: expect.stringContaining('capturedAt') });
    expect(results[1].status).toBe(SyncStatus.Applied);
  });

  it('fails entity types the caller role may not push', async () => {
    const mechanic = actorOf(farmId, Role.Mechanic);

    const { results } = await service.push(mechanic, { deviceId: DEVICE, items: [taskItem(randomUUID(), randomUUID())] });

    expect(results[0].status).toBe(SyncStatus.Failed);
  });

  it('refuses a client id that already belongs to another farm', async () => {
    const clientId = randomUUID();
    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });

    const { results } = await service.push(actorOf(randomUUID()), { deviceId: 'device-9', items: [observationItem(clientId)] });

    expect(results[0].status).toBe(SyncStatus.Failed);
  });

  it('soft-deletes a field only for a chief agronomist and tombstones other deletes for the owner', async () => {
    const fieldId = randomUUID();
    const fieldItem: SyncItemDto = {
      entityType: SyncEntityType.Field, clientId: fieldId, operation: SyncOperation.Upsert, clientTimestamp: T0, payload: { name: 'F' },
    };
    const remove: SyncItemDto = { ...fieldItem, operation: SyncOperation.Delete, clientTimestamp: T1 };
    await service.push(scout, { deviceId: DEVICE, items: [fieldItem] });

    const denied = await service.push(scout, { deviceId: DEVICE, items: [remove] });
    const allowed = await service.push(actorOf(farmId, Role.ChiefAgronomist), { deviceId: 'device-c', items: [remove] });

    expect(denied.results[0].status).toBe(SyncStatus.Failed);
    expect(allowed.results[0].status).toBe(SyncStatus.Applied);
    expect((await db.getRepository(FieldEntity).findOneByOrFail({ id: fieldId })).deletedAt).not.toBeNull();
  });

  it('derives field area, bbox and centroid from a pushed contour', async () => {
    const fieldId = randomUUID();
    const contour = { type: 'Polygon', coordinates: [[[30, 50], [30.01, 50], [30.01, 50.01], [30, 50.01], [30, 50]]] };

    await service.push(scout, { deviceId: DEVICE, items: [{
      entityType: SyncEntityType.Field, clientId: fieldId, operation: SyncOperation.Upsert, clientTimestamp: T0,
      payload: { name: 'F', areaHa: 1, contour },
    }] });

    const row = await db.getRepository(FieldEntity).findOneByOrFail({ id: fieldId });
    expect(row.areaHa).toBeGreaterThan(50);
    expect(row.bbox).toEqual([30, 50, 30.01, 50.01]);
    expect(row.centroidLat).toBeCloseTo(50.005);
  });

  it('fails a field whose contour is not a valid polygon', async () => {
    const { results } = await service.push(scout, { deviceId: DEVICE, items: [{
      entityType: SyncEntityType.Field, clientId: randomUUID(), operation: SyncOperation.Upsert, clientTimestamp: T0,
      payload: { name: 'F', contour: { type: 'Point', coordinates: [1, 2] } },
    }] });

    expect(results[0].status).toBe(SyncStatus.Failed);
  });

  it('stores the substances derived by the treatment log, not the ones the client sent', async () => {
    const clientId = randomUUID();

    const { results } = await service.push(scout, { deviceId: DEVICE, items: [{
      entityType: SyncEntityType.Treatment, clientId, operation: SyncOperation.Upsert, clientTimestamp: T0,
      payload: {
        fieldId: randomUUID(), productId: randomUUID(), activeSubstanceCodes: ['client'], doseValue: 1, doseUnit: 'l/ha',
        treatedAreaHa: 2, appliedAt: '2026-11-10',
      },
    }] });

    expect(results[0].status).toBe(SyncStatus.Applied);
    expect((await db.getRepository(TreatmentEntity).findOneByOrFail({ id: clientId })).activeSubstanceCodes).toEqual(['derived']);
    expect(recordedInputs).toHaveLength(1);
  });

  it('drops pushed coordinates when the user opted out of geo collection', async () => {
    const users = db.getRepository(UserEntity);
    await users.save(users.create({
      id: scout.userId, farmId, email: 'a@b.c', passwordHash: 'x', displayName: 'A', role: Role.Scout, trustWeight: 1,
      locale: 'uk', geoCollectionEnabled: false, isActive: true,
    } as never));
    const clientId = randomUUID();

    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId, { lat: 50.1, lng: 30.2, gpsAccuracyM: 5 })] });

    expect(await db.getRepository(ObservationEntity).findOneByOrFail({ id: clientId })).toMatchObject({ lat: null, lng: null, gpsAccuracyM: null });
  });

  it('tolerates device clock skew when a device without a prior write edits a newer server row', async () => {
    const clientId = randomUUID();
    await service.push(scout, { deviceId: DEVICE, items: [observationItem(clientId)] });
    const slightlyBehind = new Date(Date.now() - 1000).toISOString();

    const { results } = await service.push(scout, {
      deviceId: 'device-2', items: [observationItem(clientId, { textNote: 'skewed' }, slightlyBehind)],
    });

    expect(results[0].status).toBe(SyncStatus.Applied);
  });
});
