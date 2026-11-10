import { Candidate } from './pipeline-types';

/** Pairs of proposed products where either label lists the other as incompatible (tank-mix compatibility, spec section 5 step 3). */
export function incompatiblePairs(chosen: Candidate[]): [string, string][] {
  const pairs: [string, string][] = [];
  chosen.forEach((first, index) => {
    for (const second of chosen.slice(index + 1)) {
      const clash = first.registration.incompatibleWith.includes(second.product.product.id)
        || second.registration.incompatibleWith.includes(first.product.product.id);
      if (clash) pairs.push([first.product.product.name, second.product.product.name]);
    }
  });
  return pairs;
}
