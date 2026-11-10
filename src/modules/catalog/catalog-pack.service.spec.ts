import { CropEntity, ProductEntity } from '../../domain/entities';
import { ProposalEntityType, ProposalOperation, Role } from '../../domain/enums';
import { createCatalogContext, TEST_REGION } from './__fixtures__/catalog-test-context';

const chief = { id: 'u-chief', role: Role.ChiefAgronomist };

describe('CatalogPackService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  beforeEach(async () => { ctx = await createCatalogContext(); });
  afterEach(() => ctx.dataSource.destroy());

  it('builds a full pack with products, substances and reference image urls', async () => {
    const pack = await ctx.packs.build(TEST_REGION);
    expect(pack).toMatchObject({ regionCode: TEST_REGION, version: 1, sinceVersion: null, deleted: {} });
    expect(pack.crops).toHaveLength(5);
    expect(pack.thresholds.length).toBeGreaterThan(0);
    expect(pack.products[0].activeSubstances.length).toBeGreaterThan(0);
    expect(pack.referenceImages[0].url).toMatch(/^\/api\/v1\/catalog\/reference-images\/.+\/file$/);
  });

  it('keeps the ETag stable until the catalogue version changes', async () => {
    const before = await ctx.packs.etag(TEST_REGION);
    expect(await ctx.packs.etag(TEST_REGION)).toBe(before);
    const p = await ctx.proposals.create({ entityType: ProposalEntityType.Product, operation: ProposalOperation.Create, payload: { name: 'P' } }, chief);
    await ctx.proposals.approve(p.id, chief.id);
    expect(await ctx.packs.etag(TEST_REGION)).not.toBe(before);
  });

  it('returns only rows changed after sinceVersion', async () => {
    const p = await ctx.proposals.create({ entityType: ProposalEntityType.Product, operation: ProposalOperation.Create, payload: { name: 'Delta Product' } }, chief);
    await ctx.proposals.approve(p.id, chief.id);

    const delta = await ctx.packs.build(TEST_REGION, 1);

    expect(delta.products.map((x) => x.name)).toEqual(['Delta Product']);
    expect(delta.crops).toHaveLength(0);
    expect(delta.version).toBe(2);
  });

  it('lists deleted ids in the delta', async () => {
    const product = await ctx.repo(ProductEntity).findOneByOrFail({ name: 'Folicur 250 EC' });
    const p = await ctx.proposals.create({ entityType: ProposalEntityType.Product, entityId: product.id, operation: ProposalOperation.Delete, payload: {} }, chief);
    await ctx.proposals.approve(p.id, chief.id);

    expect((await ctx.packs.build(TEST_REGION, 1)).deleted).toEqual({ product: [product.id] });
    expect((await ctx.packs.build(TEST_REGION, 2)).deleted).toEqual({});
  });

  it('serves rows of another region only to that region', async () => {
    await ctx.repo(CropEntity).save(ctx.repo(CropEntity).create({ code: 'barley_local', nameUk: 'Ячмінь', nameEn: 'Barley', regionCode: 'UA-WEST' }));
    expect((await ctx.packs.build(TEST_REGION)).crops.map((c) => c.code)).not.toContain('barley_local');
    await ctx.repo(CropEntity).manager.query("INSERT INTO catalog_state (regionCode, version, publishedAt, lastVerifiedAt) VALUES ('UA-WEST', 1, datetime('now'), datetime('now'))");
    expect((await ctx.packs.build('UA-WEST')).crops.map((c) => c.code)).toContain('barley_local');
  });
});
