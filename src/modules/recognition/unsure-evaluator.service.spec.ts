import { testConfig } from './__fixtures__/recognition-fixtures';
import { UnsureReason } from './recognition.constants';
import { UnsureContext, UnsureEvaluator } from './unsure-evaluator.service';

describe('UnsureEvaluator', () => {
  const confident: UnsureContext = {
    providerFailed: false, providerSaysOutOfDistribution: false, topCodeKnown: true, topProbability: 0.8, normalizedEntropy: 0.3,
  };
  const reasonFor = (overrides: Partial<UnsureContext>) => new UnsureEvaluator(testConfig()).reasonFor({ ...confident, ...overrides });

  it('returns null for a confident, known, low-entropy result', () => {
    expect(reasonFor({})).toBeNull();
  });

  it('returns low_confidence when top-1 is below the threshold', () => {
    expect(reasonFor({ topProbability: 0.49 })).toBe(UnsureReason.LowConfidence);
  });

  it('does not fire at exactly the threshold', () => {
    expect(reasonFor({ topProbability: 0.5 })).toBeNull();
  });

  it('returns high_entropy when normalised entropy exceeds the threshold', () => {
    expect(reasonFor({ normalizedEntropy: 0.9 })).toBe(UnsureReason.HighEntropy);
  });

  it('returns out_of_distribution when the provider flags it', () => {
    expect(reasonFor({ providerSaysOutOfDistribution: true })).toBe(UnsureReason.OutOfDistribution);
  });

  it('returns out_of_distribution when no labelled reference photo is close enough', () => {
    expect(reasonFor({ referencesSayOutOfDistribution: true })).toBe(UnsureReason.OutOfDistribution);
  });

  it('returns unknown_code when the top code is not in the catalogue', () => {
    expect(reasonFor({ topCodeKnown: false })).toBe(UnsureReason.UnknownCode);
  });

  it('prefers provider_error over every other reason', () => {
    expect(reasonFor({ providerFailed: true, topProbability: 0, topCodeKnown: false })).toBe(UnsureReason.ProviderError);
  });
});
