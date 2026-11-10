import {
  ProductEntity, ProductRegistrationEntity, ThresholdEntity, TreatmentEntity,
} from '../../../domain/entities';
import { ProblemCategory, RateUnit, ResistanceSystem, ThresholdMetric, PollinatorHazard } from '../../../domain/enums';
import { ProductView, SubstanceView } from '../catalog.reader';
import { Candidate, PipelineContext, PipelineInput, newContext } from '../pipeline/pipeline-types';
import { RecommendationSettings } from '../recommendation.settings';

export const TODAY = new Date('2026-06-10T00:00:00Z');

export const settings = (overrides: Partial<RecommendationSettings> = {}): RecommendationSettings => ({
  maxItems: 3, maxSameGroupPerSeason: 2, seasonStartMonth: 3,
  rankWeights: { efficacy: 0.5, stock: 0.3, cost: 0.2 }, autoApproveMinConfidence: 0.9,
  safetyBuffers: { waterM: 50, apiaryM: 4000, settlementM: 300 }, weatherHorizonHours: 72,
  catalogStaleDays: 180, defaultRegion: 'UA-DEFAULT', minActionProbability: 0.5, approachingThresholdFraction: 0.7,
  defaultCropCycleDays: 150, cropCycleDays: { wheat_winter: 300 }, ...overrides,
});

export const registration = (overrides: Partial<ProductRegistrationEntity> = {}): ProductRegistrationEntity =>
  Object.assign(new ProductRegistrationEntity(), {
    id: 'reg-1', productId: 'prod-1', cropId: 'crop-1', diagnosisId: 'diag-1', rateMin: 0.5, rateMax: 1.5,
    rateUnit: RateUnit.LPerHa, maxApplications: 2, minIntervalDays: 14, preHarvestIntervalDays: 30, bbchFrom: 30, bbchTo: 69,
    efficacyScore: 0.8, incompatibleWith: [], maxWindSpeedMs: null, minTempC: null, maxTempC: null,
    source: 'demo_seed', sourceRef: 'Reg-1', verifiedAt: '2026-01-01', isDemo: true, ...overrides,
  });

export const substance = (overrides: Partial<SubstanceView> = {}): SubstanceView => ({
  code: 'tebuconazole', nameUk: 'Тебуконазол', concentration: '250 g/l', resistanceSystem: ResistanceSystem.Frac,
  resistanceGroup: '3', maxApplicationsPerSeason: null, ...overrides,
});

export const productView = (overrides: Partial<ProductEntity> = {}, substances: SubstanceView[] = [substance()]): ProductView => ({
  product: Object.assign(new ProductEntity(), {
    id: 'prod-1', name: 'Fungex', registrationNumber: 'UA-001', pollinatorHazard: PollinatorHazard.Low,
    waterProtectionZoneM: 0, apiaryZoneM: 0, settlementZoneM: 0, pricePerHaUah: 500, source: 'demo_seed',
    sourceRef: 'Registry', verifiedAt: '2026-01-01', isDemo: true, ...overrides,
  }),
  substances,
});

export const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  registration: registration(), product: productView(), rateValue: 1, exclusion: null, rotationOk: true,
  rotationNote: null, stock: { inStock: false, quantity: null, unit: null }, costPerHaUah: 500, score: 0, ...overrides,
});

export const treatment = (overrides: Partial<TreatmentEntity> = {}): TreatmentEntity =>
  Object.assign(new TreatmentEntity(), {
    id: 't-1', productId: 'prod-1', activeSubstanceCodes: ['tebuconazole'], resistanceGroups: [{ system: 'FRAC', group: '3' }],
    appliedAt: '2026-05-20', ...overrides,
  });

export const threshold = (overrides: Partial<ThresholdEntity> = {}): ThresholdEntity =>
  Object.assign(new ThresholdEntity(), {
    id: 'thr-1', diagnosisId: 'diag-1', cropId: 'crop-1', bbchFrom: 30, bbchTo: 69, metric: ThresholdMetric.PestsPerM2,
    thresholdValue: 10, urgentValue: 30, unit: 'pcs/m2', source: 'demo_seed', sourceRef: 'Threshold doc', verifiedAt: '2026-01-01', ...overrides,
  });

export const pipelineInput = (overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  farmId: 'farm-1', crop: { id: 'crop-1', code: 'wheat_winter' },
  diagnosis: {
    id: 'diag-1', code: 'brown_rust', nameUk: 'Бура іржа', nameEn: 'Brown rust', category: ProblemCategory.Disease,
    isQuarantine: false, isCritical: false, probability: 0.9, confirmed: false, unsure: false,
    pestDensityPerPlant: null, pestDensityPerM2: null, damagePercent: null,
  },
  bbch: 40,
  field: { id: 'field-1', areaHa: 10, sowingDate: null, nearWater: false, nearApiary: false, nearSettlement: false },
  location: { lat: 50, lng: 30 }, treatments: [], thresholds: [], today: TODAY,
  safetyBuffers: { waterM: 50, apiaryM: 4000, settlementM: 300 }, catalog: { version: 3, verifiedAt: '2026-01-01', stale: false },
  ...overrides,
});

export const contextFor = (overrides: Partial<PipelineInput> = {}): PipelineContext => newContext(pipelineInput(overrides));
