import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { SyncRecordEntity } from '../../domain/entities';
import { SyncOperation, SyncStatus } from '../../domain/enums';
import { SyncSettings } from './sync.settings';
import { PushRequestDto, PushResponseDto, PushResultDto, SyncItemDto } from './dto/push.dto';
import {
  EntitySyncHandler, HandlerOutcome, SYNC_HANDLERS, SyncActor, SyncChange, SyncContext,
} from './handlers/entity-sync-handler';

/** Applies a client batch idempotently: `sync_records` remembers every applied item per device. */
@Injectable()
export class SyncPushService {
  private readonly logger = new Logger(SyncPushService.name);
  private readonly handlers: Map<string, EntitySyncHandler>;
  private readonly applyOrder: Map<string, number>;
  private readonly batchSize: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly settings: SyncSettings,
    @InjectRepository(SyncRecordEntity) private readonly records: Repository<SyncRecordEntity>,
    @Inject(SYNC_HANDLERS) handlers: EntitySyncHandler[],
  ) {
    this.batchSize = config.get('sync', { infer: true }).batchSize;
    this.handlers = new Map(handlers.map((handler) => [handler.entityType, handler]));
    this.applyOrder = new Map(handlers.map((handler, index) => [handler.entityType, index]));
  }

  async push(actor: SyncActor, request: PushRequestDto): Promise<PushResponseDto> {
    if (request.items.length > this.batchSize) {
      throw new BadRequestException(`a push carries at most ${this.batchSize} items`);
    }
    const ctx: SyncContext = { ...actor, deviceId: request.deviceId, clockSkewMs: this.settings.clockSkewMs };
    const results: PushResultDto[] = [];
    for (const item of this.inDependencyOrder(request.items)) results.push(await this.applyOne(ctx, item));
    return { results, serverTime: new Date().toISOString() };
  }

  private inDependencyOrder(items: SyncItemDto[]): SyncItemDto[] {
    return [...items].sort((a, b) => (this.applyOrder.get(a.entityType) ?? 0) - (this.applyOrder.get(b.entityType) ?? 0));
  }

  private async applyOne(ctx: SyncContext, item: SyncItemDto): Promise<PushResultDto> {
    const base = { clientId: item.clientId, entityType: item.entityType };
    try {
      const handler = this.handlers.get(item.entityType);
      if (!handler) throw new BadRequestException('unsupported entity type');
      if (!handler.roles.includes(ctx.role)) throw new BadRequestException('role may not push this entity type');
      const change: SyncChange = { clientId: item.clientId, clientTimestamp: new Date(item.clientTimestamp), payload: item.payload };
      const record = await this.records.findOneBy({ deviceId: ctx.deviceId, entityType: item.entityType, clientId: item.clientId });
      if (record && record.farmId !== ctx.farmId) throw new BadRequestException('client id belongs to another farm');
      if (record && this.isReplay(record, item.operation, change)) return { ...base, status: record.status, serverId: record.serverId };
      const outcome = await this.dispatch(handler, ctx, item.operation, change, record);
      await this.remember(ctx, item, change, outcome, record);
      return { ...base, ...outcome };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`sync item ${item.entityType} failed: ${message}`);
      return { ...base, status: SyncStatus.Failed, error: message };
    }
  }

  private isReplay(record: SyncRecordEntity, operation: SyncOperation, change: SyncChange): boolean {
    return record.operation === operation && change.clientTimestamp <= record.clientTimestamp;
  }

  private dispatch(
    handler: EntitySyncHandler, ctx: SyncContext, operation: SyncOperation, change: SyncChange, record: SyncRecordEntity | null,
  ): Promise<HandlerOutcome> {
    if (operation === SyncOperation.Delete) return handler.remove(ctx, change);
    const lastOwnWriteAt = record?.status === SyncStatus.Applied ? record.clientTimestamp : null;
    return handler.upsert(ctx, change, lastOwnWriteAt);
  }

  private async remember(
    ctx: SyncContext, item: SyncItemDto, change: SyncChange, outcome: HandlerOutcome, record: SyncRecordEntity | null,
  ): Promise<void> {
    const row = record ?? this.records.create({
      farmId: ctx.farmId, userId: ctx.userId, deviceId: ctx.deviceId, entityType: item.entityType, clientId: item.clientId,
    });
    Object.assign(row, {
      serverId: outcome.serverId, operation: item.operation, status: outcome.status, error: null,
      clientTimestamp: change.clientTimestamp, appliedAt: new Date(),
    });
    await this.records.save(row);
  }
}
