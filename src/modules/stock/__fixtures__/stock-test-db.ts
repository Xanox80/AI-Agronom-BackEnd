import { DataSource } from 'typeorm';
import { ALL_ENTITIES, FarmEntity, ProductEntity } from '../../../domain/entities';

export async function createStockTestDb(): Promise<DataSource> {
  const ds = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: ALL_ENTITIES, synchronize: true });
  return ds.initialize();
}

export function saveFarm(ds: DataSource, name = 'Farm'): Promise<FarmEntity> {
  return ds.getRepository(FarmEntity).save(ds.getRepository(FarmEntity).create({
    name, regionCode: 'UA', timezone: 'Europe/Kyiv', defaultSafetyBuffers: { waterM: 1, apiaryM: 1, settlementM: 1 },
  }));
}

export function saveProduct(ds: DataSource, name: string, isDemo = true): Promise<ProductEntity> {
  return ds.getRepository(ProductEntity).save(ds.getRepository(ProductEntity).create({ name, isDemo }));
}
