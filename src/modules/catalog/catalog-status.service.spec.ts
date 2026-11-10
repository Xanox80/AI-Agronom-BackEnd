import { ProductEntity } from '../../domain/entities';
import { createCatalogContext, TEST_REGION, TEST_STALE_DAYS } from './__fixtures__/catalog-test-context';
import { MS_PER_DAY, SEED_ACTUALITY_DATE } from './catalog.constants';

const seedDate = new Date(SEED_ACTUALITY_DATE);
const daysAfterSeed = (days: number) => new Date(seedDate.getTime() + days * MS_PER_DAY);

describe('CatalogStatusService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  beforeEach(async () => { ctx = await createCatalogContext(); });
  afterEach(() => ctx.dataSource.destroy());

  it('is not stale exactly at the stale-days boundary', async () => {
    const status = await ctx.status.getStatus(TEST_REGION, daysAfterSeed(TEST_STALE_DAYS));
    expect(status).toMatchObject({ daysSinceVerified: TEST_STALE_DAYS, stale: false, staleAfterDays: TEST_STALE_DAYS });
  });

  it('warns that the data is stale one day after the limit', async () => {
    const status = await ctx.status.getStatus(TEST_REGION, daysAfterSeed(TEST_STALE_DAYS + 1));
    expect(status.stale).toBe(true);
  });

  it('resets the stale clock when the chief agronomist re-verifies', async () => {
    const later = daysAfterSeed(TEST_STALE_DAYS * 2);
    const status = await ctx.status.markVerified(TEST_REGION, later);
    expect(status).toMatchObject({ stale: false, daysSinceVerified: 0 });
  });

  it('falls back to the default region for an unknown region', async () => {
    const status = await ctx.status.getStatus('UA-UNKNOWN', seedDate);
    expect(status.regionCode).toBe(TEST_REGION);
  });

  it('reports demo data while demo rows exist', async () => {
    expect((await ctx.status.getStatus(TEST_REGION, seedDate)).containsDemoData).toBe(true);
  });

  it('warns when one product row is stale although the catalogue was verified recently', async () => {
    await ctx.repo(ProductEntity).createQueryBuilder().update().set({ verifiedAt: '2000-01-01' }).execute();
    const status = await ctx.status.getStatus(TEST_REGION, seedDate);
    expect(status).toMatchObject({ stale: true, oldestRowVerifiedAt: '2000-01-01' });
  });
});
