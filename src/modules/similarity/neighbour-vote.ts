import { ReferenceExample, ReferenceNeighbour } from './similarity.types';

/** The `perCode` closest distinct neighbours of each allowed code over all photos, best first. */
export function closestExamples(perPhoto: ReferenceNeighbour[][], allowedCodes: string[], perCode: number): ReferenceExample[] {
  const allowed = new Set(allowedCodes);
  const best = new Map<string, ReferenceNeighbour>();
  perPhoto.flat().filter((n) => allowed.has(n.diagnosisCode)).forEach((n) => {
    if ((best.get(n.id)?.score ?? -Infinity) < n.score) best.set(n.id, n);
  });
  const taken = new Map<string, number>();
  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .filter((n) => {
      const count = taken.get(n.diagnosisCode) ?? 0;
      taken.set(n.diagnosisCode, count + 1);
      return count < perCode;
    })
    .map(({ id, diagnosisCode, score, attribution }) => ({ id, diagnosisCode, score, attribution }));
}

export interface NeighbourVote {
  votes: Record<string, number>;
  bestScore: number;
  neighbourCount: number;
}

/** One photo's neighbours to vote shares summing to 1; empty when no neighbour has a positive score. */
function votesOfPhoto(neighbours: ReferenceNeighbour[], exponent: number): Map<string, number> {
  const weights = new Map<string, number>();
  neighbours.filter((n) => n.score > 0)
    .forEach((n) => weights.set(n.diagnosisCode, (weights.get(n.diagnosisCode) ?? 0) + n.score ** exponent));
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  return new Map([...weights].map(([code, weight]) => [code, weight / total]));
}

/**
 * Similarity-weighted kNN vote, averaged over photos so each angle counts once.
 * Neighbours labelled with codes outside `allowedCodes` (other crops, retired classes) are ignored.
 */
export function voteOnNeighbours(perPhoto: ReferenceNeighbour[][], allowedCodes: string[], exponent: number): NeighbourVote | null {
  const allowed = new Set(allowedCodes);
  const usable = perPhoto.map((neighbours) => neighbours.filter((n) => allowed.has(n.diagnosisCode)));
  const photoVotes = usable.map((neighbours) => votesOfPhoto(neighbours, exponent)).filter((votes) => votes.size);
  if (!photoVotes.length) return null;

  const votes: Record<string, number> = {};
  photoVotes.forEach((photo) => photo.forEach((share, code) => { votes[code] = (votes[code] ?? 0) + share / photoVotes.length; }));
  const all = usable.flat();
  return { votes, bestScore: Math.max(...all.map((n) => n.score)), neighbourCount: all.length };
}
