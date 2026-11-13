import { readFile } from 'fs/promises';
import { VisionPhoto } from '../../vision-provider/vision.types';
import { DatasetImage } from '../indexing/dataset-scanner';
import { CachedPhoto, EmbeddingCache } from './embedding-cache';

export interface BatchImageEmbedder {
  embedMany(photos: VisionPhoto[]): Promise<number[][]>;
}

export interface EmbeddingProgress {
  embedded: number;
  reused: number;
  failed: number;
  total: number;
}

/**
 * Brings a dataset's cache up to date: only photos not embedded before go through the model, in batches.
 * A failing batch is retried photo by photo so one corrupt file costs only itself.
 */
export class DatasetEmbedder {
  constructor(
    private readonly embedder: BatchImageEmbedder,
    private readonly cache: EmbeddingCache,
    private readonly batchSize: number,
  ) {}

  async embed(source: string, images: DatasetImage[], onProgress: (progress: EmbeddingProgress) => void): Promise<CachedPhoto[]> {
    const cached = new Map(this.cache.load(source).map((photo) => [photo.path, photo]));
    const missing = images.filter((image) => !cached.has(image.relativePath));
    const progress: EmbeddingProgress = { embedded: 0, reused: images.length - missing.length, failed: 0, total: images.length };
    for (let start = 0; start < missing.length; start += this.batchSize) {
      const batch = missing.slice(start, start + this.batchSize);
      (await this.embedBatch(batch, progress)).forEach((photo) => cached.set(photo.path, photo));
      onProgress({ ...progress });
    }
    if (missing.length) this.cache.save(source, [...cached.values()]);
    const wanted = new Set(images.map((image) => image.relativePath));
    return [...cached.values()].filter((photo) => wanted.has(photo.path));
  }

  private async embedBatch(batch: DatasetImage[], progress: EmbeddingProgress): Promise<CachedPhoto[]> {
    try {
      const vectors = await this.embedder.embedMany(await Promise.all(batch.map(toPhoto)));
      progress.embedded += batch.length;
      return batch.map((image, i) => ({ path: image.relativePath, label: image.label, vector: vectors[i] }));
    } catch {
      const photos: CachedPhoto[] = [];
      for (const image of batch) {
        try {
          const [vector] = await this.embedder.embedMany([await toPhoto(image)]);
          photos.push({ path: image.relativePath, label: image.label, vector });
          progress.embedded += 1;
        } catch {
          progress.failed += 1;
        }
      }
      return photos;
    }
  }
}

async function toPhoto(image: DatasetImage): Promise<VisionPhoto> {
  return { bytes: await readFile(image.absolutePath), mimeType: image.mimeType };
}
