import { buildSimilarityConfig } from './similarity.config';

describe('buildSimilarityConfig', () => {
  it('is disabled by default so the app runs without Qdrant', () => {
    expect(buildSimilarityConfig({})).toMatchObject({ enabled: false, collection: 'crop_references', blendWeight: 0.3, oodMinScore: 0 });
  });

  it('requires QDRANT_URL once enabled', () => {
    expect(() => buildSimilarityConfig({ SIMILARITY_ENABLED: 'true' })).toThrow('QDRANT_URL');
    expect(buildSimilarityConfig({ SIMILARITY_ENABLED: 'true', QDRANT_URL: 'http://localhost:6333' }).enabled).toBe(true);
  });

  it('rejects a blend weight outside 0..1', () => {
    expect(() => buildSimilarityConfig({ SIMILARITY_BLEND_WEIGHT: '1.5' })).toThrow('SIMILARITY_BLEND_WEIGHT');
  });

  it('rejects an unknown embedder dtype', () => {
    expect(() => buildSimilarityConfig({ SIMILARITY_EMBEDDER_DTYPE: 'int4' })).toThrow('SIMILARITY_EMBEDDER_DTYPE');
  });

  it('runs the embedder on the CPU unless a GPU is chosen', () => {
    expect(buildSimilarityConfig({})).toMatchObject({ embedderDevice: 'cpu', embedderGpuId: 0 });
    expect(buildSimilarityConfig({ SIMILARITY_EMBEDDER_DEVICE: 'dml', SIMILARITY_EMBEDDER_GPU_ID: '1' })).toMatchObject({ embedderDevice: 'dml', embedderGpuId: 1 });
    expect(() => buildSimilarityConfig({ SIMILARITY_EMBEDDER_DEVICE: 'tpu' })).toThrow('SIMILARITY_EMBEDDER_DEVICE');
  });
});
