import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { FieldEntity, ObservationEntity } from '../../domain/entities';
import { AnalyticsSettings } from './analytics.settings';
import { dateRangeOperator, resolveDateWindow } from './date-window';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { ObservationDiagnosisResolver, ResolvedDiagnosis } from './observation-diagnosis.resolver';
import { enforceRowCap } from './row-cap';

export interface ResolvedObservation { observation: ObservationEntity; diagnosis: ResolvedDiagnosis | null }

/** Applies the analytics filters (field, crop, diagnosis, dates, season) to a farm's observations. */
@Injectable()
export class ObservationSelector {
  private readonly seasonStartMonth: number;

  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    private readonly resolver: ObservationDiagnosisResolver,
    config: ConfigService<AppConfig, true>,
    private readonly settings: AnalyticsSettings,
  ) {
    this.seasonStartMonth = config.get('recommendation', { infer: true }).seasonStartMonth;
  }

  async select(farmId: string, filter: AnalyticsFilterDto): Promise<ResolvedObservation[]> {
    const capturedAt = dateRangeOperator(resolveDateWindow(filter, this.seasonStartMonth), (date) => date);
    const where: FindOptionsWhere<ObservationEntity> = {
      farmId,
      ...(filter.fieldId && { fieldId: filter.fieldId }),
      ...(filter.cropId && { cropId: filter.cropId }),
      ...(capturedAt && { capturedAt }),
    };
    const rows = enforceRowCap(
      await this.observations.find({ where, order: { capturedAt: 'ASC' }, take: this.settings.maxRows + 1 }),
      this.settings.maxRows,
    );
    const diagnoses = await this.resolver.resolve(rows);
    const selected = rows.map((observation) => ({ observation, diagnosis: diagnoses.get(observation.id) ?? null }));
    return filter.diagnosisId ? selected.filter((item) => item.diagnosis?.id === filter.diagnosisId) : selected;
  }

  async fieldsById(farmId: string, ids: string[]): Promise<Map<string, FieldEntity>> {
    if (ids.length === 0) return new Map();
    const rows = await this.fields.find({ where: { farmId, id: In(ids) } });
    return new Map(rows.map((field) => [field.id, field]));
  }
}
