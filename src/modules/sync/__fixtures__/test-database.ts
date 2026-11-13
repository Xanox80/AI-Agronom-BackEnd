import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ALL_ENTITIES, FarmEntity } from '../../../domain/entities';
import { Role } from '../../../domain/enums';
import { SyncActor } from '../handlers/entity-sync-handler';
import { SyncSettings } from '../sync.settings';

export async function openTestDatabase(): Promise<DataSource> {
  const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: ALL_ENTITIES, synchronize: true });
  return dataSource.initialize();
}

export const syncSettings = { backoffBaseMs: 1000, backoffMaxMs: 60000, backoffFactor: 2, batchSize: 3, refineConcurrency: 1,
  refineMaxAttempts: 3, refineRetryBaseMs: 1000, refineRetryMaxMs: 1500, refineQuotaPauseMs: 10000,clientConfigExposed: true };

export function fakeConfig(): ConfigService<never, true> {
  const values: Record<string, unknown> = {
    sync: syncSettings, app: { apiPrefix: 'api/v1' }, catalog: { defaultRegion: 'UA-DEFAULT' },
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;
}

export async function createFarm(dataSource: DataSource, regionCode = 'UA-DEFAULT'): Promise<string> {
  const repo = dataSource.getRepository(FarmEntity);
  const farm = await repo.save(repo.create({
    name: 'Test farm', regionCode, timezone: 'Europe/Kyiv', defaultSafetyBuffers: { waterM: 1, apiaryM: 1, settlementM: 1 },
  }));
  return farm.id;
}

export const actorOf = (farmId: string, role: Role = Role.Scout): SyncActor => ({ userId: randomUUID(), farmId, role });

export const SKEW_MS = 60000;

export function testSyncSettings(pullPageSize = 100): SyncSettings {
  return new SyncSettings(new ConfigService({ SYNC_PULL_PAGE_SIZE: pullPageSize, SYNC_CLOCK_SKEW_MS: SKEW_MS }));
}
