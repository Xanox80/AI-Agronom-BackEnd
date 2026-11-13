import { join } from 'path';
import { SourcedVector } from '../classifier/source-balance';
import { ClassMapping } from '../indexing/class-mapping';
import { splitOf } from './dataset-split';
import { CachedPhoto } from './embedding-cache';
import { TestPhoto } from './lab-evaluation';

export interface LabSamples {
  train: SourcedVector[];
  test: TestPhoto[];
}

/** Turns one dataset's embedded photos into training and test samples labelled with catalogue codes. */
export function splitSamples(photos: CachedPhoto[], mapping: ClassMapping, folder: string, testFraction: number): LabSamples {
  const samples: LabSamples = { train: [], test: [] };
  photos.forEach((photo) => {
    const mapped = mapping.classes[photo.label];
    if (!mapped) return;
    if (splitOf(photo.path, testFraction) === 'test') {
      samples.test.push({ vector: photo.vector, label: mapped.diagnosisCode, source: mapping.source, file: join(folder, photo.path) });
    } else {
      samples.train.push({ vector: photo.vector, label: mapped.diagnosisCode, source: mapping.source });
    }
  });
  return samples;
}

export function countByCode(samples: Array<{ label: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  samples.forEach(({ label }) => { counts[label] = (counts[label] ?? 0) + 1; });
  return counts;
}
