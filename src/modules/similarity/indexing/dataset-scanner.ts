import { readdirSync } from 'fs';
import { basename, dirname, extname, join, relative } from 'path';

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

export interface DatasetImage {
  absolutePath: string;
  /** Relative to the dataset root, with forward slashes, so point ids do not depend on the OS. */
  relativePath: string;
  /** Name of the folder holding the image: the class label in folder-per-class datasets. */
  label: string;
  mimeType: string;
}

/** Every image under `root`, labelled by its parent folder; sorted for a reproducible order. */
export function scanDataset(root: string): DatasetImage[] {
  const images: DatasetImage[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      const mimeType = IMAGE_MIME_TYPES[extname(entry.name).toLowerCase()];
      if (entry.isFile() && mimeType) {
        images.push({ absolutePath: path, relativePath: relative(root, path).split('\\').join('/'), label: basename(dirname(path)), mimeType });
      }
    }
  };
  walk(root);
  return images.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Image count per label, so a dry run shows what is mapped, what is not, and the class balance. */
export function countByLabel(images: DatasetImage[]): Map<string, number> {
  const counts = new Map<string, number>();
  images.forEach((image) => counts.set(image.label, (counts.get(image.label) ?? 0) + 1));
  return counts;
}

/**
 * Keeps at most `limit` images of each label, so one huge class does not drown the rest of the vote.
 * Picks evenly spaced files rather than the first ones: datasets are often sorted by source or camera.
 */
export function capPerLabel(images: DatasetImage[], limit: number): DatasetImage[] {
  if (limit <= 0) return images;
  const byLabel = new Map<string, DatasetImage[]>();
  images.forEach((image) => byLabel.set(image.label, [...(byLabel.get(image.label) ?? []), image]));
  return [...byLabel.values()].flatMap((group) => (group.length <= limit
    ? group
    : Array.from({ length: limit }, (_, i) => group[Math.floor((i * group.length) / limit)])));
}
