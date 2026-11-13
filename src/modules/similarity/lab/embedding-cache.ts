import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/** One photo's embedding with the dataset label it was filed under. */
export interface CachedPhoto {
  /** Relative to the dataset folder, forward slashes. */
  path: string;
  label: string;
  vector: number[];
}

interface CacheIndex {
  dimension: number;
  photos: Array<{ path: string; label: string }>;
}

/** File-safe folder name for one embedder variant, e.g. "onnx-community__dinov2-base__fp16". */
export function embedderSlug(model: string, dtype: string): string {
  return `${model}__${dtype}`.replace(/[^a-zA-Z0-9._-]+/g, '__');
}

/**
 * Embeddings of one embedder variant, one pair of files per dataset source: a JSON index and the raw
 * float32 vectors (a JSON array would be ~4x larger). Survives deleting the photos themselves, so the
 * classifier can still be retrained on them.
 */
export class EmbeddingCache {
  constructor(private readonly folder: string) {}

  load(source: string): CachedPhoto[] {
    const indexFile = join(this.folder, `${source}.json`);
    if (!existsSync(indexFile)) return [];
    const index = JSON.parse(readFileSync(indexFile, 'utf8')) as CacheIndex;
    const raw = readFileSync(join(this.folder, `${source}.f32`));
    const vectors = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    return index.photos.map((photo, i) => ({
      ...photo, vector: Array.from(vectors.subarray(i * index.dimension, (i + 1) * index.dimension)),
    }));
  }

  save(source: string, photos: CachedPhoto[]): void {
    mkdirSync(this.folder, { recursive: true });
    const dimension = photos[0]?.vector.length ?? 0;
    const vectors = new Float32Array(photos.length * dimension);
    photos.forEach((photo, i) => vectors.set(photo.vector, i * dimension));
    writeFileSync(join(this.folder, `${source}.f32`), Buffer.from(vectors.buffer));
    const index: CacheIndex = { dimension, photos: photos.map(({ path, label }) => ({ path, label })) };
    writeFileSync(join(this.folder, `${source}.json`), JSON.stringify(index));
  }
}
