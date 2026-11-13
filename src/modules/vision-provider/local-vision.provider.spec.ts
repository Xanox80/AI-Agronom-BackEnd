import { ReferenceClassifier } from '../similarity/classifier/reference-classifier.service';
import { ImageEmbedder } from '../similarity/similarity.types';
import { LocalVisionProvider } from './local-vision.provider';
import { VisionProviderError } from './vision-provider.error';
import { UNKNOWN, VisionInput } from './vision.types';

const input = (overrides: Partial<VisionInput> = {}): VisionInput => ({
  photos: [{ bytes: Buffer.alloc(1), mimeType: 'image/jpeg' }], context: { cropCode: 'wheat_winter' },
  allowedDiagnosisCodes: ['rust', 'septoria', 'mildew', 'healthy'], locale: 'uk', ...overrides,
});

function providerWith(votes: Record<string, number> | null, trained = true) {
  const embedder: ImageEmbedder = { embed: jest.fn().mockResolvedValue([1, 0]) };
  const classifier = { trained, votes: jest.fn().mockReturnValue(votes) } as unknown as ReferenceClassifier;
  return { provider: new LocalVisionProvider('clip+probe', embedder, classifier, 3), classifier };
}

describe('LocalVisionProvider', () => {
  it('returns the top classifier codes as hypotheses with a localized evidence line', async () => {
    const { provider, classifier } = providerWith({ rust: 0.1, septoria: 0.6, mildew: 0.2, healthy: 0.1 });
    const output = await provider.analyze(input());

    expect(output.hypotheses.map((h) => [h.diagnosisCode, h.probability])).toEqual([['septoria', 0.6], ['mildew', 0.2], ['rust', 0.1]]);
    expect(output.hypotheses[0]).toMatchObject({ stage: null, region: null, evidence: expect.stringContaining('локальною') });
    expect(output).toMatchObject({ crop: 'wheat_winter', organ: UNKNOWN, problemCategory: UNKNOWN, pest: null, clarifyingQuestions: [], outOfDistribution: false });
    expect(classifier.votes).toHaveBeenCalledWith([[1, 0]], ['rust', 'septoria', 'mildew', 'healthy']);
  });

  it('reports out of distribution for a crop the model was never trained on', async () => {
    const output = await providerWith(null).provider.analyze(input({ context: { cropCode: 'sunflower' }, allowedDiagnosisCodes: ['phomopsis_sunflower'] }));

    expect(output).toMatchObject({ hypotheses: [], outOfDistribution: true });
  });

  it('fails as a provider error when no classifier is trained', async () => {
    await expect(providerWith(null, false).provider.analyze(input())).rejects.toBeInstanceOf(VisionProviderError);
  });
});
