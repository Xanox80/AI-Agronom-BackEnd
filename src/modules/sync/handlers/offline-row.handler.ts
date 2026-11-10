import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { OfflineEntity } from '../../../domain/entities';
import { Role, SyncEntityType, SyncStatus } from '../../../domain/enums';
import {
  EntitySyncHandler, HandlerOutcome, SyncChange, SyncContext, validatePayload,
} from './entity-sync-handler';

/**
 * Shared idempotent upsert for rows created on a device: the client UUID is the row id,
 * a stale client edit (older than the server's version) is reported as a conflict.
 */
export abstract class OfflineRowHandler<E extends OfflineEntity, P extends object> implements EntitySyncHandler {
  abstract readonly entityType: SyncEntityType;
  abstract readonly roles: readonly Role[];
  protected abstract readonly payloadClass: new () => P;

  constructor(protected readonly repo: Repository<E>) {}

  protected abstract build(ctx: SyncContext, change: SyncChange, payload: P): DeepPartial<E> | Promise<DeepPartial<E>>;
  protected abstract edit(row: E, payload: P): void;
  /** Rejects payload references that point outside the caller's farm; runs before any create or edit. */
  protected async assertReferencesAllowed(_ctx: SyncContext, _payload: P): Promise<void> {}
  protected ownerId(_row: E): string | null { return null; }
  protected async afterCreate(_row: E): Promise<void> {}
  protected async deleteRow(row: E): Promise<void> { await this.repo.delete(row.id); }

  async upsert(ctx: SyncContext, change: SyncChange, lastOwnWriteAt: Date | null): Promise<HandlerOutcome> {
    const payload = await validatePayload(this.payloadClass, change.payload);
    await this.assertReferencesAllowed(ctx, payload);
    const existing = await this.findOwned(ctx, change.clientId);
    if (!existing) {
      const created = await this.repo.save(this.repo.create(await this.build(ctx, change, payload)));
      await this.afterCreate(created);
      return { status: SyncStatus.Applied, serverId: created.id };
    }
    if (this.isStale(ctx, change, lastOwnWriteAt, existing)) {
      return { status: SyncStatus.Conflict, serverId: existing.id };
    }
    this.edit(existing, payload);
    await this.repo.save(existing);
    return { status: SyncStatus.Applied, serverId: existing.id };
  }

  /** Own writes compare device clock to device clock; against server rows the device time is capped at now and skew-tolerant. */
  private isStale(ctx: SyncContext, change: SyncChange, lastOwnWriteAt: Date | null, existing: E): boolean {
    if (lastOwnWriteAt) return change.clientTimestamp < lastOwnWriteAt;
    const deviceTime = Math.min(change.clientTimestamp.getTime(), Date.now());
    return deviceTime + ctx.clockSkewMs < existing.updatedAt.getTime();
  }

  async remove(ctx: SyncContext, change: SyncChange): Promise<HandlerOutcome> {
    const existing = await this.findOwned(ctx, change.clientId);
    if (!existing) throw new BadRequestException('nothing to delete');
    if (ctx.role !== Role.ChiefAgronomist && this.ownerId(existing) !== ctx.userId) {
      throw new ForbiddenException('only the owner or a chief agronomist can delete');
    }
    await this.deleteRow(existing);
    return { status: SyncStatus.Applied, serverId: existing.id };
  }

  protected async findOwned(ctx: SyncContext, clientId: string): Promise<E | null> {
    const row = await this.repo.findOne({ where: { clientId } as never });
    if (row && row.farmId !== ctx.farmId) throw new ForbiddenException('id belongs to another farm');
    return row;
  }
}
