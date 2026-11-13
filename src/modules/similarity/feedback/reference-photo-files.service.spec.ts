import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { buildSimilarityConfig } from '../similarity.config';
import { CONFIRMED_SOURCE, ReferenceIndex, ReferencePayload } from '../similarity.types';
import { ReferencePhotoFiles } from './reference-photo-files.service';

describe('ReferencePhotoFiles', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'datasets-'));
    mkdirSync(join(root, 'wheat', 'Rust'), { recursive: true });
    writeFileSync(join(root, 'wheat', 'Rust', 'a.png'), 'png-bytes');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const filesFor = (payload: Partial<ReferencePayload> | null) => {
    const index = { payloadOf: jest.fn().mockResolvedValue(payload) } as unknown as ReferenceIndex;
    const storage = { read: jest.fn().mockResolvedValue(Buffer.from('stored')), save: jest.fn(), remove: jest.fn() };
    return { files: new ReferencePhotoFiles(buildSimilarityConfig({ SIMILARITY_DATASETS_DIR: root }), index, storage), storage };
  };

  it('serves a dataset photo from below the datasets folder', async () => {
    const photo = await filesFor({ source: 'kaggle', datasetRoot: 'wheat', imagePath: 'Rust/a.png' }).files.read('id');

    expect(photo).toEqual({ bytes: Buffer.from('png-bytes'), mimeType: 'image/png' });
  });

  it('serves a confirmed photo from photo storage', async () => {
    const { files, storage } = filesFor({ source: CONFIRMED_SOURCE, imagePath: 'photos/o1/p1.jpg' });

    expect(await files.read('id')).toEqual({ bytes: Buffer.from('stored'), mimeType: 'image/jpeg' });
    expect(storage.read).toHaveBeenCalledWith('photos/o1/p1.jpg');
  });

  it('refuses paths that escape the datasets folder', async () => {
    const escaping = filesFor({ source: 'kaggle', datasetRoot: '..', imagePath: 'secret.png' });

    await expect(escaping.files.read('id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers not found for unknown points, missing files and points indexed without a dataset root', async () => {
    const payloads = [
      null,
      { source: 'kaggle', datasetRoot: 'wheat', imagePath: 'Rust/missing.png' },
      { source: 'kaggle', imagePath: 'Rust/a.png' },
    ];
    for (const payload of payloads) {
      await expect(filesFor(payload).files.read('id')).rejects.toBeInstanceOf(NotFoundException);
    }
  });
});
