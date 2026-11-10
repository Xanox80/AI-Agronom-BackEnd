export interface WeightedVote { diagnosisId: string | null; weight: number }

export interface Consensus { diagnosisId: string; weight: number; totalWeight: number }

/** Highest summed label weight wins; null when there are no votes. Ties go to the first vote seen. */
export function computeConsensus(votes: WeightedVote[]): Consensus | null {
  const sums = new Map<string, number>();
  let totalWeight = 0;
  for (const { diagnosisId, weight } of votes) {
    if (!diagnosisId) continue;
    sums.set(diagnosisId, (sums.get(diagnosisId) ?? 0) + weight);
    totalWeight += weight;
  }
  let best: Consensus | null = null;
  for (const [diagnosisId, weight] of sums) {
    if (!best || weight > best.weight) best = { diagnosisId, weight, totalWeight };
  }
  return best;
}
