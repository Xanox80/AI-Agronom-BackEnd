import { DataSource } from 'typeorm';
import { StockItemEntity } from '../../domain/entities';
import { createStockTestDb, saveFarm, saveProduct } from './__fixtures__/stock-test-db';
import { LocalStockProvider } from './local-stock.provider';

describe('LocalStockProvider', () => {
  let ds: DataSource;
  let provider: LocalStockProvider;

  beforeEach(async () => {
    ds = await createStockTestDb();
    provider = new LocalStockProvider(ds.getRepository(StockItemEntity));
  });
  afterEach(() => ds.destroy());

  it('sums quantities over warehouses and marks the product in stock', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'A');
    const repo = ds.getRepository(StockItemEntity);
    await repo.save([
      repo.create({ farmId: farm.id, productId: product.id, quantity: 5, unit: 'l', warehouse: 'w1' }),
      repo.create({ farmId: farm.id, productId: product.id, quantity: 7, unit: 'l', warehouse: 'w2' }),
    ]);

    expect(await provider.getStock(farm.id, [product.id])).toEqual([
      { productId: product.id, inStock: true, quantity: 12, unit: 'l' },
    ]);
  });

  it('reports products without rows as out of stock', async () => {
    const farm = await saveFarm(ds);
    expect(await provider.getStock(farm.id, ['missing'])).toEqual([
      { productId: 'missing', inStock: false, quantity: 0, unit: null },
    ]);
  });

  it('does not leak stock of another farm', async () => {
    const mine = await saveFarm(ds, 'mine');
    const other = await saveFarm(ds, 'other');
    const product = await saveProduct(ds, 'A');
    const repo = ds.getRepository(StockItemEntity);
    await repo.save(repo.create({ farmId: other.id, productId: product.id, quantity: 9, unit: 'l' }));

    expect((await provider.getStock(mine.id, [product.id]))[0].inStock).toBe(false);
  });

  it('returns nothing for an empty product list', async () => {
    expect(await provider.getStock('f', [])).toEqual([]);
  });

  it('counts only rows in the first row unit when units are mixed', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    const items = ds.getRepository(StockItemEntity);
    await items.save(items.create({ farmId: farm.id, productId: product.id, quantity: 5, unit: 'l', warehouse: 'a' }));
    await items.save(items.create({ farmId: farm.id, productId: product.id, quantity: 2, unit: 'kg', warehouse: 'b' }));

    expect((await provider.getStock(farm.id, [product.id]))[0]).toMatchObject({ quantity: 5, unit: 'l' });
  });
});
