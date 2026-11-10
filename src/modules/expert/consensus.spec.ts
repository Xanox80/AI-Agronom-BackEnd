import { computeConsensus } from './consensus';

describe('computeConsensus', () => {
  it('returns null without votes', () => {
    expect(computeConsensus([])).toBeNull();
    expect(computeConsensus([{ diagnosisId: null, weight: 3 }])).toBeNull();
  });

  it('lets one heavier expert outvote two lighter users', () => {
    const result = computeConsensus([
      { diagnosisId: 'a', weight: 1 }, { diagnosisId: 'a', weight: 1 }, { diagnosisId: 'b', weight: 3 },
    ]);
    expect(result).toEqual({ diagnosisId: 'b', weight: 3, totalWeight: 5 });
  });

  it('sums weights of equal diagnoses', () => {
    const result = computeConsensus([{ diagnosisId: 'a', weight: 2 }, { diagnosisId: 'a', weight: 2 }, { diagnosisId: 'b', weight: 3 }]);
    expect(result?.diagnosisId).toBe('a');
    expect(result?.weight).toBe(4);
  });
});
