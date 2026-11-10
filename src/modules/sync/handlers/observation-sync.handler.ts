import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { ObservationEntity } from '../../../domain/entities';
import { ObservationStatus, Role, SyncEntityType } from '../../../domain/enums';
import { DomainEvent, ObservationCreatedEvent } from '../../../domain/events';
import { CropMemoryService } from '../../fields/crop-memory.service';
import { ObservationEnricher } from '../enrichment/observation-enricher';
import { ObservationPayloadDto } from '../dto/payloads.dto';
import { FieldAccess } from '../../tasks/field-access';
import { RefinementQueueService } from '../refinement/refinement-queue.service';
import { SyncChange, SyncContext, optionalDate } from './entity-sync-handler';
import { OfflineRowHandler } from './offline-row.handler';

@Injectable()
export class ObservationSyncHandler extends OfflineRowHandler<ObservationEntity, ObservationPayloadDto> {
  readonly entityType = SyncEntityType.Observation;
  readonly roles = [Role.Scout, Role.ChiefAgronomist, Role.Mechanic];
  protected readonly payloadClass = ObservationPayloadDto;

  constructor(
    @InjectRepository(ObservationEntity) repo: Repository<ObservationEntity>,
    private readonly events: EventEmitter2,
    private readonly refinement: RefinementQueueService,
    private readonly enricher: ObservationEnricher,
    private readonly cropMemory: CropMemoryService,
    private readonly fieldAccess: FieldAccess,
  ) {
    super(repo);
  }

  protected async assertReferencesAllowed(ctx: SyncContext, p: ObservationPayloadDto): Promise<void> {
    if (p.fieldId) await this.fieldAccess.require(ctx.farmId, p.fieldId);
  }

  protected async build(ctx: SyncContext, change: SyncChange, p: ObservationPayloadDto): Promise<DeepPartial<ObservationEntity>> {
    const enriched = await this.enricher.enrich(ctx.farmId, ctx.userId, p);
    return {
      id: change.clientId, clientId: change.clientId, farmId: ctx.farmId, userId: ctx.userId,
      ...enriched, cropId: p.cropId ?? null, bbchStage: p.bbchStage ?? null,
      capturedAt: new Date(p.capturedAt), deviceModel: p.deviceModel ?? null, organ: p.organ ?? null, textNote: p.textNote ?? null,
      scaleMarkerUsed: p.scaleMarkerUsed ?? false, isQuickCapture: p.isQuickCapture ?? false,
      status: ObservationStatus.Synced, clientCreatedAt: optionalDate(p.clientCreatedAt) ?? change.clientTimestamp,
    };
  }

  /** Human-editable fields only: confirmation and diagnosis state belong to the server. */
  protected edit(row: ObservationEntity, p: ObservationPayloadDto): void {
    row.fieldId = p.fieldId ?? row.fieldId;
    row.cropId = p.cropId ?? row.cropId;
    row.bbchStage = p.bbchStage ?? row.bbchStage;
    row.textNote = p.textNote ?? row.textNote;
    row.organ = p.organ ?? row.organ;
  }

  protected ownerId(row: ObservationEntity): string { return row.userId; }

  protected async afterCreate(row: ObservationEntity): Promise<void> {
    const event: ObservationCreatedEvent = { observationId: row.id, farmId: row.farmId, userId: row.userId };
    this.events.emit(DomainEvent.ObservationCreated, event);
    if (row.fieldId && row.cropId) await this.cropMemory.remember(row.userId, { id: row.fieldId, farmId: row.farmId }, row.cropId);
    await this.refinement.scheduleWhenPhotosExist(row.id, row.farmId);
  }

  protected async deleteRow(): Promise<void> {
    throw new BadRequestException('observation deletion is not supported through sync');
  }
}
