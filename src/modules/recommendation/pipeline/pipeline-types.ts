import { ActionLevel, ProblemCategory } from '../../../domain/enums';
import type { SafetyWarning } from '../../../domain/types';
import { ProductRegistrationEntity, ThresholdEntity, TreatmentEntity } from '../../../domain/entities';
import { ProductView } from '../catalog.reader';
import { WeatherWindow } from '../../weather/weather.types';

/** Machine-readable explanation of a decision; the UI and explanation builder translate the code. */
export interface Reason { code: string; params: Record<string, unknown> }

export interface DiagnosisInput {
  id: string; code: string; nameUk: string; nameEn: string; category: ProblemCategory;
  isQuarantine: boolean; isCritical: boolean;
  probability: number; confirmed: boolean; unsure: boolean;
  pestDensityPerPlant: number | null; pestDensityPerM2: number | null;
  /** Scout-measured share (0-100) of leaf area or plants affected; drives the percent-based thresholds. */
  damagePercent: number | null;
}

export interface FieldInput {
  id: string; areaHa: number; sowingDate: string | null;
  nearWater: boolean; nearApiary: boolean; nearSettlement: boolean;
}

export interface PipelineInput {
  farmId: string;
  crop: { id: string; code: string };
  diagnosis: DiagnosisInput;
  bbch: number | null;
  field: FieldInput | null;
  location: { lat: number; lng: number } | null;
  treatments: TreatmentEntity[];
  thresholds: ThresholdEntity[];
  today: Date;
  safetyBuffers: { waterM: number; apiaryM: number; settlementM: number };
  catalog: { version: number; verifiedAt: string | null; stale: boolean };
}

export interface Candidate {
  registration: ProductRegistrationEntity;
  product: ProductView;
  rateValue: number;
  exclusion: Reason | null;
  rotationOk: boolean;
  rotationNote: Reason | null;
  stock: { inStock: boolean; quantity: number | null; unit: string | null };
  costPerHaUah: number | null;
  score: number;
}

export interface PipelineContext {
  readonly input: PipelineInput;
  actionLevel: ActionLevel;
  actionReason: Reason;
  threshold: ThresholdEntity | null;
  thresholdExceeded: boolean | null;
  candidates: Candidate[];
  warnings: SafetyWarning[];
  weather: WeatherWindow | null;
  stopped: boolean;
}

/** One stage of the deterministic engine; stages run in sequence and may stop the pipeline. */
export interface PipelineStep {
  run(context: PipelineContext): Promise<void>;
}

export const CONSULT_EXPERT_WARNING = 'consult_expert';
export const THRESHOLD_UNMEASURED_WARNING = 'threshold_unmeasured';
export const PRE_HARVEST_UNVERIFIED_WARNING = 'pre_harvest_unverified';
export const TANK_MIX_WARNING = 'tank_mix_incompatible';

export function newContext(input: PipelineInput): PipelineContext {
  return {
    input, actionLevel: ActionLevel.Observe, actionReason: { code: 'unset', params: {} }, threshold: null,
    thresholdExceeded: null, candidates: [], warnings: [], weather: null, stopped: false,
  };
}

export function warn(context: PipelineContext, code: string, severity: SafetyWarning['severity'], params: Record<string, unknown> = {}): void {
  context.warnings.push({ code, params, severity });
}

export const eligible = (context: PipelineContext): Candidate[] => context.candidates.filter((c) => !c.exclusion);
