import { ReferenceClassifier } from './classifier/reference-classifier.service';
import { buildSimilarityConfig, SimilarityConfig } from './similarity.config';
import { SimilarCaseFinder } from './similar-case-finder.service';
import { ImageEmbedder, ReferenceIndex } from './similarity.types';

const photo = { bytes: Buffer.alloc(1), mimeType: 'image/jpeg' };
const config = (overrides: Partial<SimilarityConfig> = {}): SimilarityConfig =>
  ({ ...buildSimilarityConfig({ QDRANT_URL: 'http://qdrant' }), enabled: true, ...overrides });

const noClassifier = { votes: jest.fn().mockReturnValue(null) } as unknown as ReferenceClassifier;

function finderWith(nearest: ReferenceIndex['nearest'], cfg = config(), classifier = noClassifier) {
  const embedder: ImageEmbedder = { embed: jest.fn().mockResolvedValue([1, 0]) };
  const index: ReferenceIndex = { prepare: jest.fn(), upsert: jest.fn(), removeSource: jest.fn(), labelledVectors: jest.fn(), nearest: jest.fn(nearest), payloadOf: jest.fn() };
  return { finder: new SimilarCaseFinder(cfg, embedder, index, classifier), embedder, index };
}

describe('SimilarCaseFinder', () => {
  it('returns the neighbour vote filtered by crop', async () => {
    const { finder, index } = finderWith(async () => [{ id: 'p1', attribution: 'kaggle', diagnosisCode: 'rust', cropCode: 'wheat_winter', score: 0.9 }]);
    const evidence = await finder.find([photo, photo], 'wheat_winter', ['rust']);

    expect(evidence).toMatchObject({ votes: { rust: 1 }, bestScore: 0.9, voteSource: 'neighbours', farFromReferences: false });
    expect(index.nearest).toHaveBeenCalledTimes(2);
    expect(index.nearest).toHaveBeenCalledWith([1, 0], 'wheat_winter', 20);
  });

  it('prefers the trained classifier vote and keeps the neighbours for the OOD score', async () => {
    const classifier = { votes: jest.fn().mockReturnValue({ septoria: 0.7, rust: 0.3 }) } as unknown as ReferenceClassifier;
    const { finder } = finderWith(async () => [{ id: 'p1', attribution: 'kaggle', diagnosisCode: 'rust', cropCode: 'x', score: 0.5 }], config({ oodMinScore: 0.7 }), classifier);
    const evidence = await finder.find([photo], null, ['rust', 'septoria']);

    expect(evidence).toMatchObject({ votes: { septoria: 0.7, rust: 0.3 }, voteSource: 'classifier', bestScore: 0.5, farFromReferences: true });
    expect(classifier.votes).toHaveBeenCalledWith([[1, 0]], ['rust', 'septoria']);
  });

  it('marks the photos far from references below the OOD score', async () => {
    const { finder } = finderWith(async () => [{ id: 'p1', attribution: 'kaggle', diagnosisCode: 'rust', cropCode: 'x', score: 0.5 }], config({ oodMinScore: 0.7 }));

    expect((await finder.find([photo], null, ['rust']))?.farFromReferences).toBe(true);
  });

  it('does nothing and has no weight when disabled', async () => {
    const { finder, embedder } = finderWith(async () => [], config({ enabled: false }));

    expect(await finder.find([photo], null, ['rust'])).toBeNull();
    expect(embedder.embed).not.toHaveBeenCalled();
    expect(finder.blendWeight).toBe(0);
  });

  it('returns null instead of failing recognition when Qdrant errors', async () => {
    const { finder } = finderWith(async () => { throw new Error('ECONNREFUSED'); });

    expect(await finder.find([photo], null, ['rust'])).toBeNull();
  });

  it('gives up after the time budget', async () => {
    const { finder } = finderWith(() => new Promise(() => undefined), config({ timeoutMs: 10 }));

    expect(await finder.find([photo], null, ['rust'])).toBeNull();
  });
});
