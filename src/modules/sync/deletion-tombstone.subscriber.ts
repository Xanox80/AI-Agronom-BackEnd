import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, RemoveEvent } from 'typeorm';
import { SyncRecordEntity, TaskEntity, TreatmentEntity } from '../../domain/entities';
import { SyncEntityType, SyncOperation, SyncStatus } from '../../domain/enums';

export const SERVER_DEVICE_ID = 'server';

/** Records deletions made through REST so a pull can report them; sync's own deletes already leave a sync record. */
@Injectable()
export class DeletionTombstoneSubscriber implements EntitySubscriberInterface {
  private static readonly TRACKED = new Map<unknown, SyncEntityType>([[TaskEntity, SyncEntityType.Task], [TreatmentEntity, SyncEntityType.Treatment]]);

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterRemove(event: RemoveEvent<TaskEntity | TreatmentEntity>): Promise<void> {
    const entityType = DeletionTombstoneSubscriber.TRACKED.get(event.metadata.target);
    const row = event.entity;
    const id = event.entityId ?? row?.id;
    if (!entityType || !row || typeof id !== 'string') return;
    const now = new Date();
    const records = event.manager.getRepository(SyncRecordEntity);
    const key = { deviceId: SERVER_DEVICE_ID, entityType, clientId: id };
    const tombstone = await records.findOneBy(key) ?? records.create(key);
    Object.assign(tombstone, {
      farmId: row.farmId, userId: 'createdByUserId' in row ? row.createdByUserId : row.recordedByUserId, serverId: id,
      operation: SyncOperation.Delete, status: SyncStatus.Applied, clientTimestamp: now, appliedAt: now,
    });
    await records.save(tombstone);
  }
}
