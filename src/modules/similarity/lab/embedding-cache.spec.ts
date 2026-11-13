import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EmbeddingCache, embedderSlug } from './embedding-cache';

describe('EmbeddingCache', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'emb-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('gives every embedder variant its own folder name', () => {
    expect(embedderSlug('onnx-community/dinov2-base', 'fp16')).toBe('onnx-community__dinov2-base__fp16');
  });

  it('is empty for a source never embedded', () => {
    expect(new EmbeddingCache(dir).load('wheat')).toEqual([]);
  });

  it('gives back the saved photos with their labels and vectors', () => {
    const cache = new EmbeddingCache(join(dir, 'model'));
    cache.save('wheat', [{ path: 'Rust/a.jpg', label: 'Rust', vector: [0.5, -0.25] }, { path: 'Ok/b.jpg', label: 'Ok', vector: [1, 0] }]);
    expect(new EmbeddingCache(join(dir, 'model')).load('wheat')).toEqual([
      { path: 'Rust/a.jpg', label: 'Rust', vector: [0.5, -0.25] }, { path: 'Ok/b.jpg', label: 'Ok', vector: [1, 0] },
    ]);
  });
});
