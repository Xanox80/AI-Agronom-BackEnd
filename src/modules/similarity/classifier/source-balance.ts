import { LabelledVector } from './softmax-classifier';

export interface SourcedVector extends LabelledVector {
  source: string;
}

/**
 * Within each class every dataset source gets the same total weight (mean weight per class stays 1), so
 * 1300 lab-style photos of a disease do not outvote 200 field photos of it. `maxWeight` caps a single
 * photo: one freshly confirmed field photo must not count as much as a whole dataset.
 */
export function balanceSources(samples: SourcedVector[], maxWeight = Number.POSITIVE_INFINITY): LabelledVector[] {
  const perGroup = new Map<string, number>();
  const sourcesPerLabel = new Map<string, Set<string>>();
  const perLabel = new Map<string, number>();
  const group = (label: string, source: string) => `${label}\u0000${source}`;
  samples.forEach(({ label, source }) => {
    perGroup.set(group(label, source), (perGroup.get(group(label, source)) ?? 0) + 1);
    sourcesPerLabel.set(label, (sourcesPerLabel.get(label) ?? new Set()).add(source));
    perLabel.set(label, (perLabel.get(label) ?? 0) + 1);
  });
  return samples.map(({ vector, label, source }) => {
    const share = perLabel.get(label)! / sourcesPerLabel.get(label)!.size;
    return { vector, label, weight: Math.min(maxWeight, share / perGroup.get(group(label, source))!) };
  });
}
