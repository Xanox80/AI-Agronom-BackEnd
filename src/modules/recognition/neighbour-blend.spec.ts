import { SimilarityEvidence } from '../similarity/similarity.types';
import { AggregatedHypothesis } from './multi-frame-aggregator.service';
import { blendWithNeighbours } from './neighbour-blend';

const h = (diagnosisCode: string, rawProbability: number): AggregatedHypothesis =>
  ({ diagnosisCode, rawProbability, stage: null, evidence: 'provider', region: null });
const evidence = (votes: Record<string, number>): SimilarityEvidence => ({ votes, bestScore: 0.9, neighbourCount: 10, voteSource: 'neighbours', examples: [], farFromReferences: false });

describe('blendWithNeighbours', () => {
  it('mixes provider scores and neighbour votes by the weight', () => {
    const [rust, septoria] = blendWithNeighbours([h('rust', 0.6), h('septoria', 0.3)], evidence({ rust: 0.2, septoria: 0.8 }), 0.5, 'en');

    expect(rust).toMatchObject({ diagnosisCode: 'septoria', rawProbability: 0.55 });
    expect(septoria).toMatchObject({ diagnosisCode: 'rust', rawProbability: 0.4 });
  });

  it('surfaces a class the provider missed with a localized evidence line', () => {
    const blended = blendWithNeighbours([h('rust', 0.8)], evidence({ septoria: 1 }), 0.3, 'uk');

    expect(blended.find((x) => x.diagnosisCode === 'septoria')).toMatchObject({
      rawProbability: 0.3, evidence: 'Схоже на підтверджені фото з довідкової бази', region: null,
    });
  });

  it('keeps the total mass at or below one', () => {
    const blended = blendWithNeighbours([h('rust', 0.5), h('septoria', 0.4)], evidence({ rust: 0.5, mildew: 0.5 }), 0.4, 'en');

    expect(blended.reduce((sum, x) => sum + x.rawProbability, 0)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('returns the provider hypotheses unchanged without evidence or weight', () => {
    const hypotheses = [h('rust', 0.8)];

    expect(blendWithNeighbours(hypotheses, null, 0.5, 'en')).toBe(hypotheses);
    expect(blendWithNeighbours(hypotheses, evidence({ septoria: 1 }), 0, 'en')).toBe(hypotheses);
  });
});
