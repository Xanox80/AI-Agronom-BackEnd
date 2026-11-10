import { DataSource } from 'typeorm';
import {
  CatalogDiagnosisEntity, CatalogEntity, CropEntity, ProductEntity, ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../domain/entities';
import { createCatalogContext, TEST_REGION } from './__fixtures__/catalog-test-context';
import { REFERENCE_IMAGES_PER_DIAGNOSIS, SEED_ACTUALITY_DATE, SEED_REGISTRY_SOURCE } from './catalog.constants';
import { SEED_DIAGNOSES } from './seed/seed-diagnoses';
import { SEED_PRODUCTS, SEED_REGISTRATIONS } from './seed/seed-products';

describe('CatalogSeedService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  let dataSource: DataSource;

  beforeEach(async () => {
    ctx = await createCatalogContext();
    dataSource = ctx.dataSource;
  });
  afterEach(() => dataSource.destroy());

  it('seeds the five pilot crops', async () => {
    const codes = (await dataSource.getRepository(CropEntity).find()).map((c) => c.code).sort();
    expect(codes).toEqual(['maize', 'rapeseed', 'soybean', 'sunflower', 'wheat_winter']);
  });

  it('marks every seeded row with a source and an actuality date', async () => {
    const tables = [CropEntity, CatalogDiagnosisEntity, ThresholdEntity, ProductEntity, ProductRegistrationEntity, ReferenceImageEntity];
    for (const table of tables) {
      const rows: CatalogEntity[] = await dataSource.getRepository(table as new () => CatalogEntity).find();
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => {
        expect(row.source).toMatch(/^DEMO seed/);
        expect(row.verifiedAt).toBe(SEED_ACTUALITY_DATE);
        expect(row.isDemo).toBe(true);
      });
    }
  });

  it('marks product data as to be verified against the State Register', async () => {
    const products = await dataSource.getRepository(ProductEntity).find();
    expect(products).toHaveLength(SEED_PRODUCTS.length);
    products.forEach((p) => {
      expect(p.source).toBe(SEED_REGISTRY_SOURCE);
      expect(p.registrationNumber).toBeNull();
    });
  });

  it('keeps every registration inside a sane rate and BBCH range', () => {
    SEED_REGISTRATIONS.forEach((r) => {
      expect(r.rateMin).toBeLessThanOrEqual(r.rateMax);
      expect(r.bbchFrom).toBeLessThanOrEqual(r.bbchTo);
      expect(SEED_PRODUCTS.some((p) => p.key === r.productKey)).toBe(true);
      expect(SEED_DIAGNOSES.find((d) => d.code === r.diagnosisCode)?.cropCodes).toContain(r.cropCode);
    });
  });

  it('gives every diagnosis the specified number of reference image placeholders', async () => {
    const images = await dataSource.getRepository(ReferenceImageEntity).find();
    expect(images).toHaveLength(SEED_DIAGNOSES.length * REFERENCE_IMAGES_PER_DIAGNOSIS);
  });

  it('creates the regional catalogue state', async () => {
    const status = await ctx.status.getStatus(TEST_REGION, new Date(SEED_ACTUALITY_DATE));
    expect(status).toMatchObject({ version: 1, stale: false, containsDemoData: true });
  });

  it('does not seed twice', async () => {
    expect(await ctx.seeder.seed(TEST_REGION)).toBe(false);
  });
});
