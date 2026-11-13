import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ImageEmbedder, ReferenceIndex } from '../similarity.types';
import { ClassMapping } from './class-mapping';
import { DatasetImage } from './dataset-scanner';
import { ReferenceIndexer, referencePointId } from './reference-indexer';

const mapping: ClassMapping = { source: 'pv', classes: { Blight: { diagnosisCode: 'northern_leaf_blight_maize', cropCode: 'maize' } } };

describe('ReferenceIndexer', () => {
  let root: string;
  let images: DatasetImage[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'indexer-'));
    images = ['a.jpg', 'b.jpg', 'c.jpg'].map((name) => {
      writeFileSync(join(root, name), name);
      return { absolutePath: join(root, name), relativePath: `Blight/${name}`, label: 'Blight', mimeType: 'image/jpeg' };
    });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('prepares the collection once with the vector size and upserts labelled points in batches', async () => {
    const embedder: ImageEmbedder = { embed: jest.fn().mockResolvedValue([0.6, 0.8]) };
    const index: ReferenceIndex = { prepare: jest.fn(), upsert: jest.fn(), removeSource: jest.fn(), labelledVectors: jest.fn(), nearest: jest.fn(), payloadOf: jest.fn() };
    const result = await new ReferenceIndexer(embedder, index, 2).indexImages(images, mapping, 'pv/color', jest.fn());

    expect(result).toEqual({ done: 3, total: 3, failed: 0 });
    expect(index.prepare).toHaveBeenCalledTimes(1);
    expect(index.prepare).toHaveBeenCalledWith(2);
    expect(index.upsert).toHaveBeenCalledTimes(2);
    expect((index.upsert as jest.Mock).mock.calls[0][0][0]).toEqual({
      id: referencePointId('pv', 'Blight/a.jpg'),
      vector: [0.6, 0.8],
      payload: {
        diagnosisCode: 'northern_leaf_blight_maize', cropCode: 'maize', source: 'pv', imagePath: 'Blight/a.jpg', datasetLabel: 'Blight',
        datasetRoot: 'pv/color', attribution: 'pv',
      },
    });
  });

  it('skips images that fail to embed and counts them', async () => {
    const embedder: ImageEmbedder = { embed: jest.fn().mockRejectedValueOnce(new Error('corrupt')).mockResolvedValue([1, 0]) };
    const index: ReferenceIndex = { prepare: jest.fn(), upsert: jest.fn(), removeSource: jest.fn(), labelledVectors: jest.fn(), nearest: jest.fn(), payloadOf: jest.fn() };

    expect(await new ReferenceIndexer(embedder, index, 10).indexImages(images, mapping, 'pv/color', jest.fn())).toEqual({ done: 3, total: 3, failed: 1 });
    expect((index.upsert as jest.Mock).mock.calls[0][0]).toHaveLength(2);
  });

  it('aborts when nothing can be embedded instead of skipping every image', async () => {
    const embedder: ImageEmbedder = { embed: jest.fn().mockRejectedValue(new Error('model download failed')) };
    const index: ReferenceIndex = { prepare: jest.fn(), upsert: jest.fn(), removeSource: jest.fn(), labelledVectors: jest.fn(), nearest: jest.fn(), payloadOf: jest.fn() };

    await expect(new ReferenceIndexer(embedder, index, 10).indexImages(images, mapping, 'pv/color', jest.fn())).rejects.toThrow('model download failed');
    expect(index.upsert).not.toHaveBeenCalled();
  });

  it('derives a stable UUID-shaped id from source and path', () => {
    const id = referencePointId('pv', 'Blight/a.jpg');

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(referencePointId('pv', 'Blight/a.jpg')).toBe(id);
    expect(referencePointId('other', 'Blight/a.jpg')).not.toBe(id);
  });
});
