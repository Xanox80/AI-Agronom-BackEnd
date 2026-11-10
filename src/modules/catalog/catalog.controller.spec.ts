import { createCatalogContext, TEST_REGION } from './__fixtures__/catalog-test-context';
import { CatalogController } from './catalog.controller';
import { ReferenceImageFileService } from './reference-image-file.service';

const response = () => ({ setHeader: jest.fn(), status: jest.fn() });

describe('CatalogController', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  let controller: CatalogController;
  beforeEach(async () => {
    ctx = await createCatalogContext();
    controller = new CatalogController(ctx.catalog, ctx.status, ctx.packs, {} as ReferenceImageFileService);
  });
  afterEach(() => ctx.dataSource.destroy());

  it('returns the pack with an ETag header', async () => {
    const res = response();
    const pack = await controller.pack({ region: TEST_REGION }, undefined, res as never);
    expect(pack?.version).toBe(1);
    expect(res.setHeader).toHaveBeenCalledWith('ETag', await ctx.packs.etag(TEST_REGION));
  });

  it('answers 304 without a body when If-None-Match matches', async () => {
    const res = response();
    const etag = await ctx.packs.etag(TEST_REGION);
    expect(await controller.pack({ region: TEST_REGION }, etag, res as never)).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(304);
  });

  it('delegates verification to the status service', async () => {
    const status = await controller.verify({ regionCode: TEST_REGION });
    expect(status.daysSinceVerified).toBe(0);
  });
});
