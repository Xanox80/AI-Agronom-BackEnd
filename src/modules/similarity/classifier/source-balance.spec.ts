import { balanceSources } from './source-balance';

const v = (label: string, source: string) => ({ vector: [0], label, source });

describe('balanceSources', () => {
  it('gives each source the same total weight within a class', () => {
    const weighted = balanceSources([v('rust', 'kaggle'), v('rust', 'kaggle'), v('rust', 'kaggle'), v('rust', 'field')]);
    const total = (from: number[]) => from.reduce((sum, i) => sum + weighted[i].weight!, 0);

    expect(total([0, 1, 2])).toBeCloseTo(total([3]));
    expect(total([0, 1, 2, 3])).toBeCloseTo(4);
  });

  it('leaves a single-source class at weight 1', () => {
    expect(balanceSources([v('septoria', 'kaggle'), v('septoria', 'kaggle')]).map((s) => s.weight)).toEqual([1, 1]);
  });

  it('caps the weight of a single photo', () => {
    const weighted = balanceSources([v('rust', 'kaggle'), v('rust', 'kaggle'), v('rust', 'kaggle'), v('rust', 'kaggle'), v('rust', 'confirmed')], 1.5);

    expect(weighted[4].weight).toBe(1.5);
  });

  it('balances classes independently', () => {
    const weighted = balanceSources([v('rust', 'a'), v('rust', 'b'), v('rust', 'b'), v('healthy', 'a')]);

    expect(weighted.map((s) => s.weight)).toEqual([1.5, 0.75, 0.75, 1]);
  });
});
