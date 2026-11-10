import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { ALL_ENTITIES } from './domain/entities';

describe('AppModule', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
    process.env.AI_PROVIDER = 'mock';
  });

  it('boots with an in-memory database and creates every entity table', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const dataSource = app.get(DataSource);
    expect(dataSource.entityMetadatas).toHaveLength(ALL_ENTITIES.length + 1); // + diagnosis_crops join table
    expect(dataSource.entityMetadatas.map((m) => m.tableName)).toEqual(
      expect.arrayContaining(['users', 'diagnosis_results', 'catalog_diagnoses', 'audit_log']),
    );

    await app.close();
  });
});
