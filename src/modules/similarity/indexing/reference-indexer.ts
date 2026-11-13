import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { ImageEmbedder, ReferenceIndex, ReferencePoint } from '../similarity.types';
import { ClassMapping } from './class-mapping';
import { DatasetImage } from './dataset-scanner';

export interface IndexingProgress {
  done: number;
  total: number;
  failed: number;
}

/** Same source and file give the same id, so re-running the indexer updates points instead of duplicating them. */
export function referencePointId(source: string, relativePath: string): string {
  const hex = createHash('sha1').update(`${source}/${relativePath}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Embeds mapped dataset images and upserts them into the reference index in batches. */
export class ReferenceIndexer {
  private prepared = false;

  constructor(
    private readonly embedder: ImageEmbedder,
    private readonly index: ReferenceIndex,
    private readonly batchSize: number,
  ) {}

  /** `datasetRoot` is the dataset folder relative to SIMILARITY_DATASETS_DIR; without it the photos cannot be shown. */
  async indexImages(
    images: DatasetImage[], mapping: ClassMapping, datasetRoot: string | undefined, onProgress: (progress: IndexingProgress) => void,
  ): Promise<IndexingProgress> {
    const progress: IndexingProgress = { done: 0, total: images.length, failed: 0 };
    for (let start = 0; start < images.length; start += this.batchSize) {
      const { points, firstError } = await this.embedBatch(images.slice(start, start + this.batchSize), mapping, datasetRoot, progress);
      if (!this.prepared && !points.length && firstError) throw firstError;
      if (points.length && !this.prepared) {
        await this.index.prepare(points[0].vector.length);
        this.prepared = true;
      }
      await this.index.upsert(points);
      onProgress({ ...progress });
    }
    return progress;
  }

  /**
   * An unreadable or corrupt image is counted and skipped; datasets scraped from the web always have a few.
   * The first error is returned so a broken embedder (no model download) aborts instead of skipping everything.
   */
  private async embedBatch(
    batch: DatasetImage[], mapping: ClassMapping, datasetRoot: string | undefined, progress: IndexingProgress,
  ): Promise<{ points: ReferencePoint[]; firstError?: Error }> {
    const points: ReferencePoint[] = [];
    let firstError: Error | undefined;
    for (const image of batch) {
      const mapped = mapping.classes[image.label];
      try {
        const vector = await this.embedder.embed({ bytes: await readFile(image.absolutePath), mimeType: image.mimeType });
        points.push({
          id: referencePointId(mapping.source, image.relativePath),
          vector,
          payload: {
            ...mapped, source: mapping.source, imagePath: image.relativePath, datasetLabel: image.label,
            datasetRoot, attribution: mapping.attribution ?? mapping.source,
          },
        });
      } catch (error) {
        firstError ??= error as Error;
        progress.failed += 1;
      }
      progress.done += 1;
    }
    return { points, firstError };
  }
}
