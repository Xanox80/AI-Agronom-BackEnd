import { ExpertCaseReason } from '../../domain/enums';
import { Env, EnvReader } from '../../config/env-reader';

export interface ExpertConfig {
  rareClassMaxLabels: number;
  lowConfidenceThreshold: number;
  uncertaintyPriorityScale: number;
  rareClassPriorityBonus: number;
  priorityByReason: Record<ExpertCaseReason, number>;
  datasetPageSize: number;
  defaultPageSize: number;
  maxPageSize: number;
}

export const EXPERT_CONFIG = Symbol('EXPERT_CONFIG');

export function buildExpertConfig(env: Env): ExpertConfig {
  const r = new EnvReader(env);
  return {
    rareClassMaxLabels: r.number('EXPERT_RARE_CLASS_MAX_LABELS', 20),
    lowConfidenceThreshold: r.number('EXPERT_LOW_CONFIDENCE_THRESHOLD', 0.5),
    uncertaintyPriorityScale: r.number('EXPERT_PRIORITY_UNCERTAINTY_SCALE', 20),
    rareClassPriorityBonus: r.number('EXPERT_PRIORITY_RARE_BONUS', 15),
    priorityByReason: {
      [ExpertCaseReason.OutOfDistribution]: r.number('EXPERT_PRIORITY_OUT_OF_DISTRIBUTION', 80),
      [ExpertCaseReason.UserModelDisagreement]: r.number('EXPERT_PRIORITY_DISAGREEMENT', 70),
      [ExpertCaseReason.UnsureMode]: r.number('EXPERT_PRIORITY_UNSURE', 50),
      [ExpertCaseReason.LowConfidence]: r.number('EXPERT_PRIORITY_LOW_CONFIDENCE', 40),
      [ExpertCaseReason.RareClass]: r.number('EXPERT_PRIORITY_RARE_CLASS', 30),
    },
    datasetPageSize: r.number('EXPERT_DATASET_PAGE_SIZE', 500),
    defaultPageSize: r.number('EXPERT_DEFAULT_PAGE_SIZE', 20),
    maxPageSize: r.number('EXPERT_MAX_PAGE_SIZE', 100),
  };
}
