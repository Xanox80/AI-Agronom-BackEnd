import { createHash } from 'crypto';

export type Split = 'train' | 'test';

const TEST_FOLDERS = new Set(['test', 'valid', 'val', 'validation']);

/**
 * A dataset's own test/valid folders are the test set (their authors kept those photos apart). Otherwise a
 * hash of the path decides, so a photo stays on the same side across runs and the numbers stay comparable.
 */
export function splitOf(relativePath: string, testFraction: number): Split {
  const folders = relativePath.split('/').slice(0, -1).map((folder) => folder.toLowerCase());
  if (folders.some((folder) => TEST_FOLDERS.has(folder))) return 'test';
  if (folders.includes('train')) return 'train';
  const bucket = createHash('sha1').update(relativePath).digest().readUInt32BE(0) / 0x100000000;
  return bucket < testFraction ? 'test' : 'train';
}
