/** A registered product the plan may use, with the registry limits the plan must stay within. */
export interface PlanProduct {
  productId: string;
  name: string;
  activeSubstances: string;
  rateMin: number;
  rateMax: number;
  /** e.g. "l/ha" or "kg/ha". */
  rateUnit: string;
  maxApplications: number;
  minIntervalDays: number;
  preHarvestIntervalDays: number;
  bbchFrom: number;
  bbchTo: number;
  resistanceGroup: string | null;
  inStock: boolean;
}

/** Everything the plan writer is told; the validator checks the answer against the same facts. */
export interface TreatmentFacts {
  cropNameUk: string;
  diagnosisNameUk: string;
  bbch: number | null;
  areaHa: number | null;
  actionLevel: string;
  weatherVerdict: string | null;
  warningCodes: string[];
  products: PlanProduct[];
  waterLPerHa: { min: number; max: number };
}

/** One spraying as the language model proposes it. */
export interface DraftApplication {
  productId: string;
  rateValue: number;
  waterLPerHa: number;
  /** Days after the first application; the first one is 0. */
  dayOffset: number;
  timing: string;
  note: string;
}

export interface DraftPlan {
  summary: string;
  applications: DraftApplication[];
  precautions: string[];
  monitoring: string;
}

/** Tank and field proportions, computed in code from the rate and water volume, never by the model. */
export interface WorkingSolution {
  productPerHa: number;
  /** Unit of the product quantities: "l" or "kg". */
  productUnit: string;
  waterLPerHa: number;
  /** Product per 100 l of working solution. */
  productPer100L: number;
  tankVolumeL: number;
  productPerTank: number;
  hectaresPerTank: number;
  tanksForField: number | null;
  productForField: number | null;
}

export interface TreatmentPlanApplication extends DraftApplication {
  productName: string;
  rateUnit: string;
  solution: WorkingSolution;
}

/** ready: checked plan; no_treatment: the engine found nothing to apply; rejected: the model broke a registry limit. */
export type TreatmentPlanStatus = 'ready' | 'no_treatment' | 'rejected';

export interface TreatmentPlanDto {
  recommendationId: string;
  status: TreatmentPlanStatus;
  model: string | null;
  summary: string;
  applications: TreatmentPlanApplication[];
  precautions: string[];
  monitoring: string;
  /** Registry limits the model's answer broke; filled only when status is rejected. */
  validationErrors: string[];
  disclaimerCode: 'treatment_plan_needs_agronomist';
  generatedAt: string;
}
