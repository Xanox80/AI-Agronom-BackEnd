import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { TreatmentEntity } from '../../../domain/entities';
import { Role, SyncEntityType } from '../../../domain/enums';
import { TreatmentsService } from '../../tasks/treatments.service';
import { TreatmentPayloadDto } from '../dto/payloads.dto';
import { SyncChange, SyncContext, dateOnly, optionalDate } from './entity-sync-handler';
import { OfflineRowHandler } from './offline-row.handler';

@Injectable()
export class TreatmentSyncHandler extends OfflineRowHandler<TreatmentEntity, TreatmentPayloadDto> {
  readonly entityType = SyncEntityType.Treatment;
  readonly roles = [Role.Scout, Role.ChiefAgronomist];
  protected readonly payloadClass = TreatmentPayloadDto;

  constructor(@InjectRepository(TreatmentEntity) repo: Repository<TreatmentEntity>, private readonly treatments: TreatmentsService) {
    super(repo);
  }

  /** The catalogue derives substances and resistance groups, so client-sent ones are ignored; record() is idempotent by clientId. */
  protected async build(ctx: SyncContext, change: SyncChange, p: TreatmentPayloadDto): Promise<DeepPartial<TreatmentEntity>> {
    const recorded = await this.treatments.record({ id: ctx.userId, farmId: ctx.farmId, role: ctx.role }, {
      clientId: change.clientId, fieldId: p.fieldId, taskId: p.taskId, productId: p.productId, doseValue: p.doseValue,
      doseUnit: p.doseUnit, treatedAreaHa: p.treatedAreaHa, appliedAt: p.appliedAt,
    });
    return { ...recorded, clientCreatedAt: optionalDate(p.clientCreatedAt) ?? change.clientTimestamp };
  }

  protected edit(row: TreatmentEntity, p: TreatmentPayloadDto): void {
    row.doseValue = p.doseValue;
    row.doseUnit = p.doseUnit;
    row.treatedAreaHa = p.treatedAreaHa;
    row.appliedAt = dateOnly(p.appliedAt);
  }

  protected ownerId(row: TreatmentEntity): string { return row.recordedByUserId; }
}
