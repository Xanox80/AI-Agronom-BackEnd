import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  ActiveSubstanceEntity, ProductActiveSubstanceEntity, ProductEntity, TreatmentEntity,
} from '../../domain/entities';
import type { Page, ResistanceGroupUse } from '../../domain/types';
import { CreateTreatmentDto, TreatmentDetailsDto } from './dto/treatment-input.dto';
import { TreatmentQueryDto } from './dto/task-query.dto';
import { TreatmentResponseDto } from './dto/task-response.dto';
import { FieldAccess } from './field-access';
import { TaskActor } from './task-actor';
import { ISO_DATE_LENGTH } from './tasks.constants';
import { TasksSettings } from './tasks.settings';

const dateOnly = (iso: string): string => iso.slice(0, ISO_DATE_LENGTH);

export interface TreatmentRecord extends TreatmentDetailsDto { clientId: string; fieldId: string; taskId?: string }

/** Treatment log (FR-22) and the read model be-recommendation uses for rotation (FR-17). */
@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(TreatmentEntity) private readonly treatments: Repository<TreatmentEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductActiveSubstanceEntity) private readonly productSubstances: Repository<ProductActiveSubstanceEntity>,
    @InjectRepository(ActiveSubstanceEntity) private readonly substances: Repository<ActiveSubstanceEntity>,
    private readonly fieldAccess: FieldAccess,
    private readonly settings: TasksSettings,
  ) {}

  /** Pass the manager of an open transaction to save the row atomically with the caller's own writes. */
  async record(actor: TaskActor, input: TreatmentRecord, manager?: EntityManager): Promise<TreatmentEntity> {
    const log = manager ? manager.getRepository(TreatmentEntity) : this.treatments;
    const existing = await log.findOne({ where: { clientId: input.clientId, farmId: actor.farmId } });
    if (existing) return existing;
    await this.fieldAccess.require(actor.farmId, input.fieldId);
    const product = await this.products.findOne({ where: { id: input.productId } });
    if (!product) throw new BadRequestException('Unknown productId');
    const substances = await this.substancesOf(product.id);
    return log.save(log.create({
      id: input.clientId, clientId: input.clientId, farmId: actor.farmId, fieldId: input.fieldId,
      taskId: input.taskId ?? null, productId: product.id, activeSubstanceCodes: substances.map((s) => s.code),
      resistanceGroups: this.resistanceGroups(substances), doseValue: input.doseValue, doseUnit: input.doseUnit,
      treatedAreaHa: input.treatedAreaHa, appliedAt: dateOnly(input.appliedAt), recordedByUserId: actor.id,
    }));
  }

  async create(actor: TaskActor, dto: CreateTreatmentDto): Promise<TreatmentResponseDto> {
    return (await this.present([await this.record(actor, dto)]))[0];
  }

  async list(actor: TaskActor, query: TreatmentQueryDto): Promise<Page<TreatmentResponseDto>> {
    const where: FindOptionsWhere<TreatmentEntity> = { farmId: actor.farmId };
    if (query.fieldId) where.fieldId = query.fieldId;
    if (query.from && query.to) where.appliedAt = Between(dateOnly(query.from), dateOnly(query.to));
    else if (query.from) where.appliedAt = MoreThanOrEqual(dateOnly(query.from));
    else if (query.to) where.appliedAt = LessThanOrEqual(dateOnly(query.to));
    const { page, pageSize, skip } = this.settings.pageWindow(query);
    const [rows, total] = await this.treatments.findAndCount({ where, order: { appliedAt: 'DESC' }, skip, take: pageSize });
    return { items: await this.present(rows), total, page, pageSize };
  }

  /** Read model for rotation rules: treatments of a field on or after seasonStart (ISO date). */
  getTreatments(fieldId: string, seasonStart: string): Promise<TreatmentEntity[]> {
    return this.treatments.find({ where: { fieldId, appliedAt: MoreThanOrEqual(dateOnly(seasonStart)) }, order: { appliedAt: 'ASC' } });
  }

  private async substancesOf(productId: string): Promise<ActiveSubstanceEntity[]> {
    const links = await this.productSubstances.find({ where: { productId } });
    return links.length ? this.substances.find({ where: { id: In(links.map((l) => l.activeSubstanceId)) } }) : [];
  }

  private resistanceGroups(substances: ActiveSubstanceEntity[]): ResistanceGroupUse[] {
    return substances.filter((s) => s.resistanceGroup).map((s) => ({ system: s.resistanceSystem, group: s.resistanceGroup }));
  }

  private async present(rows: TreatmentEntity[]): Promise<TreatmentResponseDto[]> {
    const ids = [...new Set(rows.map((r) => r.productId))];
    const products = ids.length ? await this.products.find({ where: { id: In(ids) } }) : [];
    const names = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      id: r.id, clientId: r.clientId, fieldId: r.fieldId, productId: r.productId, productName: names.get(r.productId),
      activeSubstanceCodes: r.activeSubstanceCodes, resistanceGroups: r.resistanceGroups, doseValue: r.doseValue,
      doseUnit: r.doseUnit, treatedAreaHa: r.treatedAreaHa, appliedAt: r.appliedAt,
    }));
  }
}
