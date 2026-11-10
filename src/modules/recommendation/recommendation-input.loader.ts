import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FarmEntity, FieldEntity, ObservationEntity, TreatmentEntity,
} from '../../domain/entities';
import { CatalogReader } from './catalog.reader';
import { PipelineInput } from './pipeline/pipeline-types';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from './recommendation.settings';
import { MS_PER_DAY, seasonStartDate } from './season';

export interface RecommendationRequest { observationId: string; diagnosisId?: string; bbchStage?: number; damagePercent?: number }

export interface LoadedInput { input: PipelineInput; diagnosisResultId: string }


/** Gathers everything the engine needs (observation, diagnosis, field, history, catalogue) so the pipeline stays free of I/O. */
@Injectable()
export class RecommendationInputLoader {
  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    @InjectRepository(TreatmentEntity) private readonly treatments: Repository<TreatmentEntity>,
    @InjectRepository(FarmEntity) private readonly farms: Repository<FarmEntity>,
    private readonly catalog: CatalogReader,
    @Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings,
  ) {}

  async load(farmId: string, request: RecommendationRequest, now: Date = new Date()): Promise<LoadedInput> {
    const observation = await this.observations.findOne({ where: { id: request.observationId, farmId } });
    if (!observation) throw new NotFoundException('OBSERVATION_NOT_FOUND');
    const result = await this.results.findOne({ where: { observationId: observation.id, farmId }, order: { createdAt: 'DESC' } });
    if (!result) throw new BadRequestException('DIAGNOSIS_RESULT_MISSING');

    const field = observation.fieldId ? await this.fields.findOne({ where: { id: observation.fieldId, farmId } }) : null;
    const cropId = observation.cropId ?? field?.cropId;
    const crop = cropId ? await this.catalog.findCrop(cropId) : null;
    if (!crop) throw new BadRequestException('CROP_UNKNOWN');

    const diagnosisId = request.diagnosisId ?? observation.confirmedDiagnosisId ?? (await this.topHypothesis(result.id))?.diagnosisId;
    const diagnosis = diagnosisId ? await this.catalog.findDiagnosis(diagnosisId) : null;
    if (!diagnosis) throw new BadRequestException('DIAGNOSIS_UNKNOWN');

    const confirmed = observation.confirmedDiagnosisId === diagnosis.id;
    const hypothesis = await this.hypotheses.findOne({ where: { diagnosisResultId: result.id, diagnosisId: diagnosis.id } });
    const farm = await this.farms.findOne({ where: { id: farmId } });
    const regionCode = farm?.regionCode ?? this.settings.defaultRegion;
    const [thresholds, treatments, state] = await Promise.all([
      this.catalog.findThresholds(diagnosis.id, crop.id),
      field ? this.treatments.find({ where: { farmId, fieldId: field.id, appliedAt: MoreThanOrEqual(seasonStartDate(now, this.settings.seasonStartMonth)) } }) : [],
      this.stateFor(regionCode),
    ]);
    const oldestRow = await this.catalog.oldestProductVerification();
    const verifiedAt = state?.lastVerifiedAt ?? null;
    const lat = observation.lat ?? field?.centroidLat ?? null;
    const lng = observation.lng ?? field?.centroidLng ?? null;

    return {
      diagnosisResultId: result.id,
      input: {
        farmId, crop: { id: crop.id, code: crop.code }, bbch: request.bbchStage ?? observation.bbchStage, today: now,
        diagnosis: {
          id: diagnosis.id, code: diagnosis.code, nameUk: diagnosis.nameUk, nameEn: diagnosis.nameEn,
          category: diagnosis.problemCategory, isQuarantine: diagnosis.isQuarantine, isCritical: diagnosis.isCritical,
          probability: confirmed ? 1 : hypothesis?.probability ?? 0, confirmed, unsure: result.unsure || result.outOfDistribution,
          pestDensityPerPlant: result.pestDensityPerPlant, pestDensityPerM2: result.pestDensityPerM2,
          damagePercent: request.damagePercent ?? null,
        },
        field: field && {
          id: field.id, areaHa: field.areaHa, sowingDate: field.sowingDate,
          nearWater: field.nearWater, nearApiary: field.nearApiary, nearSettlement: field.nearSettlement,
        },
        location: lat !== null && lng !== null ? { lat, lng } : null,
        treatments, thresholds,
        safetyBuffers: farm?.defaultSafetyBuffers ?? this.settings.safetyBuffers,
        catalog: {
          version: state?.version ?? 0, verifiedAt: verifiedAt ? new Date(verifiedAt).toISOString().slice(0, 10) : null,
          stale: !verifiedAt || this.isStale(now, verifiedAt, oldestRow),
        },
      },
    };
  }

  /** Falls back to the default region, like GET /catalog/status, when the farm region has no pack of its own. */
  private async stateFor(regionCode: string) {
    return (await this.catalog.findState(regionCode)) ?? (regionCode === this.settings.defaultRegion ? null : this.catalog.findState(this.settings.defaultRegion));
  }

  /** Same rule as GET /catalog/status: the older of the pack verification and the oldest product row decides. */
  private isStale(now: Date, verifiedAt: Date | string, oldestRow: string | null): boolean {
    const ageDays = (date: Date | string) => (now.getTime() - new Date(date).getTime()) / MS_PER_DAY;
    return Math.max(ageDays(verifiedAt), oldestRow ? ageDays(oldestRow) : 0) > this.settings.catalogStaleDays;
  }

  private topHypothesis(resultId: string): Promise<DiagnosisHypothesisEntity | null> {
    return this.hypotheses.findOne({ where: { diagnosisResultId: resultId }, order: { rank: 'ASC' } });
  }
}
