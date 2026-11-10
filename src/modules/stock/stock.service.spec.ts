import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ProductEntity, StockItemEntity } from '../../domain/entities';
import { createStockTestDb, saveFarm, saveProduct } from './__fixtures__/stock-test-db';
import { StockQueryDto } from './dto/stock.dto';
import { LocalStockProvider } from './local-stock.provider';
import { StockService } from './stock.service';
import { StockSettings } from './stock.settings';

const query = (over: Partial<StockQueryDto> = {}): StockQueryDto => Object.assign(new StockQueryDto(), over);

describe('StockService', () => {
  let ds: DataSource;
  let service: StockService;

  beforeEach(async () => {
    ds = await createStockTestDb();
    const items = ds.getRepository(StockItemEntity);
    service = new StockService(items, ds.getRepository(ProductEntity), new LocalStockProvider(items), new StockSettings({ get: () => undefined } as unknown as ConfigService));
  });
  afterEach(() => ds.destroy());

  it('creates a row, then updates the same row for the same product, warehouse and lot', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    const first = await service.upsert(farm.id, product.id, { quantity: 10, unit: 'l' });
    const second = await service.upsert(farm.id, product.id, { quantity: 4, unit: 'l' });

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ quantity: 4, productName: 'Alpha', source: 'manual' });
    expect((await service.list(farm.id, query())).total).toBe(1);
  });

  it('keeps separate rows per warehouse', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    await service.upsert(farm.id, product.id, { quantity: 1, unit: 'l', warehouse: 'w1' });
    await service.upsert(farm.id, product.id, { quantity: 2, unit: 'l', warehouse: 'w2' });

    expect((await service.getAvailability(farm.id, [product.id]))[0].quantity).toBe(3);
  });

  it('rejects an unknown product', async () => {
    const farm = await saveFarm(ds);
    await expect(service.upsert(farm.id, 'nope', { quantity: 1, unit: 'l' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters the list by product name and pages it', async () => {
    const farm = await saveFarm(ds);
    const alpha = await saveProduct(ds, 'Alpha');
    const beta = await saveProduct(ds, 'Beta');
    await service.upsert(farm.id, alpha.id, { quantity: 1, unit: 'l' });
    await service.upsert(farm.id, beta.id, { quantity: 1, unit: 'l' });

    const byName = await service.list(farm.id, query({ q: 'bet' }));
    expect(byName.items.map((i) => i.productName)).toEqual(['Beta']);
    expect((await service.list(farm.id, query({ pageSize: 1 }))).items).toHaveLength(1);
  });

  it('deletes only rows of the caller farm', async () => {
    const farm = await saveFarm(ds, 'a');
    const other = await saveFarm(ds, 'b');
    const product = await saveProduct(ds, 'Alpha');
    const row = await service.upsert(farm.id, product.id, { quantity: 1, unit: 'l' });

    await expect(service.remove(other.id, row.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(farm.id, row.id)).resolves.toBeUndefined();
  });

  it('returns an empty page for a name filter without matches', async () => {
    const farm = await saveFarm(ds);
    const alpha = await saveProduct(ds, 'Alpha');
    await service.upsert(farm.id, alpha.id, { quantity: 1, unit: 'l' });

    expect(await service.list(farm.id, query({ q: 'zzz' }))).toMatchObject({ items: [], total: 0 });
  });

  it('caps the page size at the configured maximum', async () => {
    const farm = await saveFarm(ds);
    expect((await service.list(farm.id, query({ pageSize: 100000 }))).pageSize).toBe(100);
  });

  it('rejects a second unit for the same product', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    await service.upsert(farm.id, product.id, { quantity: 5, unit: 'l', warehouse: 'w1' });

    await expect(service.upsert(farm.id, product.id, { quantity: 2, unit: 'kg', warehouse: 'w2' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upsert(farm.id, product.id, { quantity: 2, unit: 'kg', warehouse: 'w1' })).resolves.toMatchObject({ unit: 'kg' });
  });

  it('keeps one row when the same key is upserted concurrently', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    await Promise.all([1, 2, 3].map((quantity) => service.upsert(farm.id, product.id, { quantity, unit: 'l' })));

    expect((await service.list(farm.id, query())).total).toBe(1);
  });

  it('imports CSV rows by name and registration number and reports skipped lines', async () => {
    const farm = await saveFarm(ds);
    const alpha = await saveProduct(ds, 'Alpha');
    await ds.getRepository(ProductEntity).update(alpha.id, { registrationNumber: 'R-1' });
    await saveProduct(ds, 'Beta');
    const csv = 'registrationNumber,productName,quantity,unit,warehouse\nR-1,,5,l,w1\n,Beta,2,kg,\n,Ghost,1,l,\n,Beta,2,l,w2\n';

    const result = await service.importCsv(farm.id, csv);

    expect(result.upserted).toBe(2);
    expect(result.skipped).toEqual([{ line: 4, reason: 'unknown_product' }, { line: 5, reason: 'unit_mismatch' }]);
    expect((await service.list(farm.id, query())).items.every((i) => i.source === 'csv')).toBe(true);
  });

  it('ignores expired lots in availability', async () => {
    const farm = await saveFarm(ds);
    const product = await saveProduct(ds, 'Alpha');
    await service.upsert(farm.id, product.id, { quantity: 9, unit: 'l', lotNumber: 'old', expiresAt: '2000-01-01' });
    await service.upsert(farm.id, product.id, { quantity: 4, unit: 'l', lotNumber: 'new', expiresAt: '2999-01-01' });

    expect((await service.getAvailability(farm.id, [product.id]))[0]).toMatchObject({ quantity: 4, inStock: true });
  });
});
