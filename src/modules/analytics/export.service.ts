import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { FieldEntity, ObservationEntity, TaskEntity, TreatmentEntity } from '../../domain/entities';
import { Page } from '../../domain/types';
import {
  FieldExportDto, ObservationExportDto, TaskExportDto, TreatmentExportDto,
} from '../../domain/export/export.dto';
import { AnalyticsSettings } from './analytics.settings';
import { dateRangeOperator, resolveDateWindow } from './date-window';
import { AnalyticsFilterDto, ExportPageQueryDto } from './dto/analytics-filter.dto';
import { ExportMapper } from './export-mapper.service';
import { ObservationSelector } from './observation-selector.service';
import { enforceRowCap } from './row-cap';

export type ExportKind = 'fields' | 'observations' | 'tasks' | 'treatments';

interface Paging { skip: number; take: number }
interface Loaded { items: unknown[]; total: number; deleted?: string[] }

/** `deleted` lists scout ids removed since `updatedSince`, so incremental clients can drop them. */
export interface ExportPage extends Page<unknown> { deleted: string[] }
type Loader = (farmId: string, since: FindOptionsWhere<{ updatedAt: Date }>, paging: Paging) => Promise<Loaded>;

const BY_UPDATE = { updatedAt: 'ASC', id: 'ASC' } as const;

@Injectable()
export class ExportService {
  private readonly pageSize: number;
  private readonly seasonStartMonth: number;
  private readonly loaders: Record<ExportKind, Loader>;

  constructor(
    @InjectRepository(FieldEntity) private readonly fieldRows: Repository<FieldEntity>,
    @InjectRepository(ObservationEntity) private readonly observationRows: Repository<ObservationEntity>,
    @InjectRepository(TaskEntity) private readonly taskRows: Repository<TaskEntity>,
    @InjectRepository(TreatmentEntity) private readonly treatmentRows: Repository<TreatmentEntity>,
    private readonly mapper: ExportMapper,
    private readonly selector: ObservationSelector,
    config: ConfigService<AppConfig, true>,
    private readonly settings: AnalyticsSettings,
  ) {
    this.pageSize = config.get('export', { infer: true }).pageSize;
    this.seasonStartMonth = config.get('recommendation', { infer: true }).seasonStartMonth;
    this.loaders = {
      fields: async (farmId, since, paging) => {
        const [rows, total] = await this.fieldRows.findAndCount({
          where: { farmId, deletedAt: IsNull(), ...since }, order: BY_UPDATE, ...paging,
        });
        return { items: await this.mapper.fields(rows), total, deleted: await this.deletedFieldIds(farmId, since) };
      },
      observations: async (farmId, since, paging) => {
        const [rows, total] = await this.observationRows.findAndCount({ where: { farmId, ...since }, order: BY_UPDATE, ...paging });
        return { items: await this.mapper.observations(farmId, rows), total };
      },
      tasks: async (farmId, since, paging) => {
        const [rows, total] = await this.taskRows.findAndCount({ where: { farmId, ...since }, order: BY_UPDATE, ...paging });
        return { items: await this.mapper.tasks(farmId, rows), total };
      },
      treatments: async (farmId, since, paging) => {
        const [rows, total] = await this.treatmentRows.findAndCount({ where: { farmId, ...since }, order: BY_UPDATE, ...paging });
        return { items: await this.mapper.treatments(farmId, rows), total };
      },
    };
  }

  async page(kind: ExportKind, farmId: string, query: ExportPageQueryDto): Promise<ExportPage> {
    const page = query.page ?? 1;
    const since = query.updatedSince ? { updatedAt: MoreThan(new Date(query.updatedSince)) } : {};
    const { items, total, deleted = [] } = await this.loaders[kind](farmId, since, { skip: (page - 1) * this.pageSize, take: this.pageSize });
    return { items, total, page, pageSize: this.pageSize, deleted };
  }

  private async deletedFieldIds(farmId: string, since: FindOptionsWhere<{ updatedAt: Date }>): Promise<string[]> {
    if (!since.updatedAt) return [];
    const rows = await this.fieldRows.find({
      where: { farmId, deletedAt: Not(IsNull()), updatedAt: since.updatedAt }, select: { id: true }, withDeleted: true,
    });
    return rows.map((field) => field.id);
  }

  async fields(farmId: string): Promise<FieldExportDto[]> {
    const rows = enforceRowCap(
      await this.fieldRows.find({ where: { farmId, deletedAt: IsNull() }, order: BY_UPDATE, take: this.settings.maxRows + 1 }),
      this.settings.maxRows,
    );
    return this.mapper.fields(rows);
  }

  async observations(farmId: string, filter: AnalyticsFilterDto): Promise<ObservationExportDto[]> {
    const selected = await this.selector.select(farmId, filter);
    return this.mapper.observations(farmId, selected.map(({ observation }) => observation));
  }

  async tasks(farmId: string, filter: AnalyticsFilterDto): Promise<TaskExportDto[]> {
    const createdAt = dateRangeOperator(resolveDateWindow(filter, this.seasonStartMonth), (date) => date);
    const rows = enforceRowCap(await this.taskRows.find({
      where: {
        farmId,
        ...(filter.fieldId && { fieldId: filter.fieldId }),
        ...(filter.diagnosisId && { diagnosisId: filter.diagnosisId }),
        ...(createdAt && { createdAt }),
      },
      order: BY_UPDATE,
      take: this.settings.maxRows + 1,
    }), this.settings.maxRows);
    return this.mapper.tasks(farmId, rows);
  }

  async treatments(farmId: string, filter: AnalyticsFilterDto): Promise<TreatmentExportDto[]> {
    const appliedAt = dateRangeOperator(resolveDateWindow(filter, this.seasonStartMonth), (date) => date.toISOString().slice(0, 10));
    const rows = enforceRowCap(await this.treatmentRows.find({
      where: { farmId, ...(filter.fieldId && { fieldId: filter.fieldId }), ...(appliedAt && { appliedAt }) },
      order: BY_UPDATE,
      take: this.settings.maxRows + 1,
    }), this.settings.maxRows);
    return this.mapper.treatments(farmId, rows);
  }
}
