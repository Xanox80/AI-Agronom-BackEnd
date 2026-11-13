import { SimilarityEvidence } from '../similarity/similarity.types';
import { AggregatedHypothesis } from './multi-frame-aggregator.service';
import { Locale } from './recognition.constants';

const NEIGHBOUR_EVIDENCE: Record<Locale, string> = {
  uk: 'Схоже на підтверджені фото з довідкової бази',
  en: 'Resembles labelled photos in the reference base',
};

/**
 * Linear blend of the provider's raw scores with the labelled-neighbour vote: (1 - w) * raw + w * vote.
 * Linear rather than geometric so a class the provider missed but the neighbours agree on can still surface.
 */
export function blendWithNeighbours(
  hypotheses: AggregatedHypothesis[], evidence: SimilarityEvidence | null, weight: number, locale: Locale,
): AggregatedHypothesis[] {
  if (!evidence || weight <= 0) return hypotheses;
  const known = new Set(hypotheses.map((h) => h.diagnosisCode));
  const blended = hypotheses.map((h) => ({
    ...h, rawProbability: (1 - weight) * h.rawProbability + weight * (evidence.votes[h.diagnosisCode] ?? 0),
  }));
  const surfaced = Object.entries(evidence.votes)
    .filter(([code]) => !known.has(code))
    .map(([code, vote]): AggregatedHypothesis => ({
      diagnosisCode: code, rawProbability: weight * vote, stage: null, evidence: NEIGHBOUR_EVIDENCE[locale], region: null,
    }));
  return [...blended, ...surfaced].sort((a, b) => b.rawProbability - a.rawProbability);
}
