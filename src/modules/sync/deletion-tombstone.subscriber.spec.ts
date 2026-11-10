import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { SyncRecordEntity, TaskEntity } from '../../domain/entities';
import { SyncEntityType, SyncOperation, SyncStatus, TaskType } from '../../domain/enums';
import { openTestDatabase } from './__fixtures__/test-database';
import { DeletionTombstoneSubscriber, SERVER_DEVICE_ID } from './deletion-tombstone.subscriber';

describe('DeletionTombstoneSubscriber', () => {
  let db: DataSource;

  beforeEach(async () => {
    db = await openTestDatabase();
    new DeletionTombstoneSubscriber(db);
  });

  afterEach(() => db.destroy());

  const saveTask = () => db.getRepository(TaskEntity).save(db.getRepository(TaskEntity).create({
    farmId: randomUUID(), createdByUserId: randomUUID(), type: TaskType.Treatment, fieldId: randomUUID(), title: 'Spray', clientId: randomUUID(), photoIds: [],
  }));

  it('records a tombstone when a task is removed through the repository', async () => {
    const task = await saveTask();
    const id = task.id;

    await db.getRepository(TaskEntity).remove(task);

    const tombstone = await db.getRepository(SyncRecordEntity).findOneByOrFail({ serverId: id });
    expect(tombstone).toMatchObject({
      deviceId: SERVER_DEVICE_ID, entityType: SyncEntityType.Task, operation: SyncOperation.Delete, status: SyncStatus.Applied,
      farmId: task.farmId,
    });
  });

  it('ignores entities it does not track', async () => {
    const task = await saveTask();

    await db.getRepository(TaskEntity).save(task);

    expect(await db.getRepository(SyncRecordEntity).count()).toBe(0);
  });
});
