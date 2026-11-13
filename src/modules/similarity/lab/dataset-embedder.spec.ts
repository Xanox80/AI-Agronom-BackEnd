import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { VisionPhoto } from '../../vision-provider/vision.types';
import { DatasetImage } from '../indexing/dataset-scanner';
import { DatasetEmbedder } from './dataset-embedder';
import { EmbeddingCache } from './embedding-cache';

describe('DatasetEmbedder', () => {
  let dir: string;
  let images: DatasetImage[];
  const embedMany = jest.fn(async (photos: VisionPhoto[]) => {
    if (photos.some((photo) => photo.bytes.toString() === 'corrupt')) throw new Error('bad image');
    return photos.map((photo) => [photo.bytes.length]);
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lab-'));
    embedMany.mockClear();
    images = ['a', 'bb', 'corrupt'].map((content) => {
      writeFileSync(join(dir, `${content}.jpg`), content);
      return { absolutePath: join(dir, `${content}.jpg`), relativePath: `Rust/${content}.jpg`, label: 'Rust', mimeType: 'image/jpeg' };
    });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('skips a corrupt photo without losing the rest of its batch', async () => {
    const embedder = new DatasetEmbedder({ embedMany }, new EmbeddingCache(join(dir, 'cache')), 8);
    const photos = await embedder.embed('wheat', images, () => undefined);
    expect(photos.map((photo) => [photo.path, photo.vector])).toEqual([['Rust/a.jpg', [1]], ['Rust/bb.jpg', [2]]]);
  });

  it('embeds each photo once: the second run reads the cache', async () => {
    const cache = new EmbeddingCache(join(dir, 'cache'));
    await new DatasetEmbedder({ embedMany }, cache, 8).embed('wheat', images.slice(0, 2), () => undefined);
    embedMany.mockClear();
    const progress = jest.fn();

    const photos = await new DatasetEmbedder({ embedMany }, cache, 8).embed('wheat', images.slice(0, 2), progress);

    expect(embedMany).not.toHaveBeenCalled();
    expect(photos).toHaveLength(2);
  });
});
