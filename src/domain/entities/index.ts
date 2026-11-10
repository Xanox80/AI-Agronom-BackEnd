import * as base from './base.entity';
import * as identity from './identity.entities';
import * as field from './field.entities';
import * as observation from './observation.entities';
import * as diagnosis from './diagnosis.entities';
import * as expert from './expert.entities';
import * as catalog from './catalog.entities';
import * as recommendation from './recommendation.entities';
import * as operations from './operations.entities';

export * from './base.entity';
export * from './identity.entities';
export * from './field.entities';
export * from './observation.entities';
export * from './diagnosis.entities';
export * from './expert.entities';
export * from './catalog.entities';
export * from './recommendation.entities';
export * from './operations.entities';

const abstractBases = new Set<unknown>([base.BaseEntity, base.TenantEntity, base.OfflineEntity, base.CatalogEntity]);

/** Every concrete entity class, registered once in TypeOrmModule.forRoot. */
export const ALL_ENTITIES = [identity, field, observation, diagnosis, expert, catalog, recommendation, operations]
  .flatMap((group) => Object.values(group))
  .filter((exported): exported is new () => unknown => typeof exported === 'function' && !abstractBases.has(exported));
