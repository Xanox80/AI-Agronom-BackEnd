import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { LocalPhotoStorage } from './local-photo-storage';

describe('LocalPhotoStorage', () => {
  let dir: string;
  let storage: LocalPhotoStorage;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scout-storage-'));
    const config = { get: () => ({ dir }) };
    storage = new LocalPhotoStorage(config as never);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('saves bytes under the storage dir and reads them back', async () => {
    await storage.save('photos/obs/a.jpg', Buffer.from('abc'));
    expect((await storage.read('photos/obs/a.jpg')).toString()).toBe('abc');
  });

  it('removes a stored file and ignores a missing one', async () => {
    await storage.save('a.jpg', Buffer.from('x'));
    await storage.remove('a.jpg');
    await storage.remove('a.jpg');
    await expect(storage.read('a.jpg')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects keys that escape the storage dir', async () => {
    await expect(storage.save('../escape.jpg', Buffer.from('x'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
