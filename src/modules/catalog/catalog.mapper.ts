import {
  ActiveSubstanceEntity, BbchStageEntity, CatalogDiagnosisEntity, CatalogEntity, CropEntity, ProductRegistrationEntity,
  ThresholdEntity,
} from '../../domain/entities';
import type {
  ActiveSubstanceDto, BbchStageDto, CatalogDiagnosisDto, CropDto, ProductRegistrationDto, ThresholdDto,
} from './dto/catalog.dto';

const provenance = (row: CatalogEntity) => ({ source: row.source, verifiedAt: row.verifiedAt, isDemo: row.isDemo });

export const toCropDto = (c: CropEntity): CropDto => ({ id: c.id, code: c.code, nameUk: c.nameUk, nameEn: c.nameEn });

export const toBbchStageDto = (s: BbchStageEntity): BbchStageDto => ({
  id: s.id, cropId: s.cropId, bbchFrom: s.bbchFrom, bbchTo: s.bbchTo, nameUk: s.nameUk, nameEn: s.nameEn, phase: s.phase,
});

export const toDiagnosisDto = (d: CatalogDiagnosisEntity): CatalogDiagnosisDto => ({
  id: d.id, code: d.code, nameUk: d.nameUk, nameEn: d.nameEn, latinName: d.latinName, problemCategory: d.problemCategory,
  isQuarantine: d.isQuarantine, isCritical: d.isCritical, typicalOrgans: d.typicalOrgans,
  descriptionUk: d.descriptionUk, descriptionEn: d.descriptionEn, cropIds: (d.crops ?? []).map((c) => c.id),
  clarifyingQuestions: d.clarifyingQuestions, ...provenance(d),
});

export const toThresholdDto = (t: ThresholdEntity): ThresholdDto => ({
  id: t.id, diagnosisId: t.diagnosisId, cropId: t.cropId, bbchFrom: t.bbchFrom, bbchTo: t.bbchTo, metric: t.metric,
  thresholdValue: t.thresholdValue, urgentValue: t.urgentValue, unit: t.unit, ...provenance(t),
});

export const toActiveSubstanceDto = (s: ActiveSubstanceEntity): ActiveSubstanceDto => ({
  id: s.id, code: s.code, nameUk: s.nameUk, nameEn: s.nameEn, resistanceSystem: s.resistanceSystem,
  resistanceGroup: s.resistanceGroup, maxApplicationsPerSeason: s.maxApplicationsPerSeason,
  source: s.source, verifiedAt: s.verifiedAt,
});

export const toRegistrationDto = (r: ProductRegistrationEntity): ProductRegistrationDto => ({
  id: r.id, productId: r.productId, cropId: r.cropId, diagnosisId: r.diagnosisId, rateMin: r.rateMin, rateMax: r.rateMax,
  rateUnit: r.rateUnit, maxApplications: r.maxApplications, minIntervalDays: r.minIntervalDays,
  preHarvestIntervalDays: r.preHarvestIntervalDays, bbchFrom: r.bbchFrom, bbchTo: r.bbchTo, efficacyScore: r.efficacyScore,
  incompatibleWith: r.incompatibleWith, maxWindSpeedMs: r.maxWindSpeedMs, minTempC: r.minTempC, maxTempC: r.maxTempC,
  ...provenance(r),
});
