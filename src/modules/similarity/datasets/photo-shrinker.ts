import { existsSync, mkdirSync } from 'fs';
import { dirname, extname, join } from 'path';
import sharp from 'sharp';
import { DatasetImage } from '../indexing/dataset-scanner';

export interface ShrinkOptions {
  /** Longest side in pixels; embedders look at 224 px, so 512 keeps headroom at a fraction of the size. */
  maxSide: number;
  jpegQuality: number;
}

export interface ShrinkProgress {
  done: number;
  total: number;
  failed: number;
}

/** Same relative path under the new root, always as .jpg (PNG scans would stay large otherwise). */
export function shrunkPath(targetRoot: string, image: DatasetImage): string {
  const relative = image.relativePath.slice(0, image.relativePath.length - extname(image.relativePath).length);
  return join(targetRoot, `${relative}.jpg`);
}

/** Writes a downsized JPEG copy of each image, keeping the folder-per-class layout; existing copies are skipped. */
export async function shrinkImages(
  images: DatasetImage[], targetRoot: string, options: ShrinkOptions, onProgress: (progress: ShrinkProgress) => void,
): Promise<ShrinkProgress> {
  const progress: ShrinkProgress = { done: 0, total: images.length, failed: 0 };
  for (const image of images) {
    const target = shrunkPath(targetRoot, image);
    if (!existsSync(target)) {
      try {
        mkdirSync(dirname(target), { recursive: true });
        await sharp(image.absolutePath).rotate()
          .resize(options.maxSide, options.maxSide, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: options.jpegQuality }).toFile(target);
      } catch {
        progress.failed += 1;
      }
    }
    progress.done += 1;
    if (progress.done % 200 === 0 || progress.done === progress.total) onProgress({ ...progress });
  }
  return progress;
}
