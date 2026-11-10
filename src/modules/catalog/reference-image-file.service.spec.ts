import { rm } from 'fs/promises';
import { resolve } from 'path';
import { ReferenceImageEntity } from '../../domain/entities';
import { createCatalogContext } from './__fixtures__/catalog-test-context';
import { PLACEHOLDER_PREFIX, REFERENCE_IMAGE_DIR } from './catalog.constants';
import { ReferenceImageFileService } from './reference-image-file.service';

const file = (over: Partial<Express.Multer.File> = {}) => ({ mimetype: 'image/jpeg', size: 10, originalname: 'a.jpg', buffer: Buffer.from('x'), ...over }) as Express.Multer.File;
const response = () => {
  const res = { redirect: jest.fn(), type: jest.fn().mockReturnThis(), send: jest.fn(), sendFile: jest.fn() };
  return res as typeof res & import('express').Response;
};

describe('ReferenceImageFileService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  let service: ReferenceImageFileService;
  beforeEach(async () => { ctx = await createCatalogContext(); service = new ReferenceImageFileService(ctx.repo(ReferenceImageEntity), ctx.config); });
  afterEach(async () => {
    await ctx.dataSource.destroy();
    await rm(resolve('./data/test-storage', REFERENCE_IMAGE_DIR), { recursive: true, force: true });
  });

  const withKey = async (storageKey: string) => {
    const image = await ctx.repo(ReferenceImageEntity).findOneByOrFail({});
    await ctx.repo(ReferenceImageEntity).update(image.id, { storageKey });
    return image.id;
  };

  it('rejects a missing, unsupported or oversized file', async () => {
    await expect(service.store(undefined)).rejects.toMatchObject({ response: { code: 'FILE_REQUIRED' } });
    await expect(service.store(file({ mimetype: 'text/plain' }))).rejects.toMatchObject({ response: { code: 'UNSUPPORTED_IMAGE_TYPE' } });
    await expect(service.store(file({ size: 2 * 1024 * 1024 }))).rejects.toMatchObject({ response: { code: 'IMAGE_TOO_LARGE' } });
  });

  it('stores a valid file under a generated key', async () => {
    expect(await service.store(file())).toMatch(/^[\w-]+\.jpg$/);
  });

  it('serves a generated placeholder as svg', async () => {
    const res = response();
    await service.send(await withKey(`${PLACEHOLDER_PREFIX}x:1`), res);
    expect(res.type).toHaveBeenCalledWith('image/svg+xml');
  });

  it('redirects a remote url', async () => {
    const res = response();
    await service.send(await withKey('https://example.com/a.jpg'), res);
    expect(res.redirect).toHaveBeenCalledWith('https://example.com/a.jpg');
  });

  it('refuses a key that escapes the storage directory', async () => {
    await expect(service.send(await withKey('../../secret.txt'), response())).rejects.toMatchObject({ response: { code: 'REFERENCE_IMAGE_NOT_FOUND' } });
  });

  it('answers 404 for an unknown image', async () => {
    await expect(service.send('missing', response())).rejects.toMatchObject({ response: { code: 'REFERENCE_IMAGE_NOT_FOUND' } });
  });
});
