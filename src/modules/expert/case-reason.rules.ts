import { ExpertCaseReason } from '../../domain/enums';

export interface DiagnosisSignals {
  outOfDistribution: boolean;
  unsure: boolean;
  topProbability: number;
  rare: boolean;
}

export interface CaseReasonRule { reason: ExpertCaseReason; applies(signals: DiagnosisSignals, lowConfidenceThreshold: number): boolean }

/** Ordered: the first matching rule names the case reason. */
export const CASE_REASON_RULES: CaseReasonRule[] = [
  { reason: ExpertCaseReason.OutOfDistribution, applies: (s) => s.outOfDistribution },
  { reason: ExpertCaseReason.UnsureMode, applies: (s) => s.unsure },
  { reason: ExpertCaseReason.LowConfidence, applies: (s, threshold) => s.topProbability < threshold },
  { reason: ExpertCaseReason.RareClass, applies: (s) => s.rare },
];

export function reasonFor(signals: DiagnosisSignals, lowConfidenceThreshold: number): ExpertCaseReason | null {
  return CASE_REASON_RULES.find((rule) => rule.applies(signals, lowConfidenceThreshold))?.reason ?? null;
}
