import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FarmEntity, ProductEntity, StockItemEntity } from '../../domain/entities';
import { createStockTestDb, saveFarm, saveProduct } from './__fixtures__/stock-test-db';
import { StockSettings } from './stock.settings';
import { StockDemoSeeder } from './stock-demo-seeder';

describe('StockDemoSeeder', () => {
  let ds: DataSource;

  const seeder = (seedDemo: boolean) => new StockDemoSeeder(
    { get: () => ({ seedDemo }) } as unknown as ConfigService<never, true>,
    new StockSettings({ get: () => undefined } as unknown as ConfigService),
    ds.getRepository(StockItemEntity), ds.getRepository(ProductEntity), ds.getRepository(FarmEntity),
  );

  beforeEach(async () => {
    ds = await createStockTestDb();
    await saveFarm(ds);
    for (const name of ['A', 'B', 'C', 'D']) await saveProduct(ds, name);
  });
  afterEach(() => ds.destroy());

  it('stocks demo products and leaves every third one out of stock', async () => {
    await seeder(true).onApplicationBootstrap();
    expect(await ds.getRepository(StockItemEntity).count()).toBe(3);
  });

  it('does nothing when demo seeding is disabled', async () => {
    await seeder(false).onApplicationBootstrap();
    expect(await ds.getRepository(StockItemEntity).count()).toBe(0);
  });

  it('does not reseed a farm that already has stock rows', async () => {
    await seeder(true).onApplicationBootstrap();
    await seeder(true).onApplicationBootstrap();
    expect(await ds.getRepository(StockItemEntity).count()).toBe(3);
  });
});
