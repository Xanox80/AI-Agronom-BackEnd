import { ExpertCaseReason } from '../../domain/enums';
import { reasonFor } from './case-reason.rules';

const calm = { outOfDistribution: false, unsure: false, topProbability: 0.9, rare: false };

describe('reasonFor', () => {
  it('returns null for a confident common diagnosis', () => {
    expect(reasonFor(calm, 0.5)).toBeNull();
  });

  it('prefers out-of-distribution over every other reason', () => {
    expect(reasonFor({ ...calm, outOfDistribution: true, unsure: true, rare: true }, 0.5)).toBe(ExpertCaseReason.OutOfDistribution);
  });

  it('flags low confidence below the threshold', () => {
    expect(reasonFor({ ...calm, topProbability: 0.4 }, 0.5)).toBe(ExpertCaseReason.LowConfidence);
  });

  it('flags a confident but rare class', () => {
    expect(reasonFor({ ...calm, rare: true }, 0.5)).toBe(ExpertCaseReason.RareClass);
  });

  it('flags unsure mode', () => {
    expect(reasonFor({ ...calm, unsure: true }, 0.5)).toBe(ExpertCaseReason.UnsureMode);
  });
});
