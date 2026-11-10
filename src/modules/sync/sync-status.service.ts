import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { CatalogStateEntity, FarmEntity, ObservationEntity, SyncRecordEntity } from '../../domain/entities';
import { PULL_MARKER_ENTITY_TYPE } from './sync-pull.service';
import { pendingRefinementQuery } from './refinement/pending-refinement';
import { SyncStatusResponse } from './dto/pull.dto';
import { SyncActor } from './handlers/entity-sync-handler';
import { SyncPullService } from './sync-pull.service';

@Injectable()
export class SyncStatusService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly pull: SyncPullService,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(SyncRecordEntity) private readonly records: Repository<SyncRecordEntity>,
    @InjectRepository(FarmEntity) private readonly farms: Repository<FarmEntity>,
    @InjectRepository(CatalogStateEntity) private readonly catalogState: Repository<CatalogStateEntity>,
  ) {}

  async status(actor: SyncActor, deviceId: string): Promise<SyncStatusResponse> {
    const sync = this.config.get('sync', { infer: true });
    const lastPush = await this.records.findOne({ where: { farmId: actor.farmId, deviceId, entityType: Not(PULL_MARKER_ENTITY_TYPE) }, order: { appliedAt: 'DESC' } });
    return {
      pendingRefinement: await this.pendingRefinement(actor.farmId),
      lastPushAt: lastPush?.appliedAt.toISOString(),
      lastPullAt: (await this.pull.lastPullAt(actor.farmId, deviceId))?.toISOString(),
      catalogVersion: await this.catalogVersion(actor.farmId),
      clientConfig: sync.clientConfigExposed
        ? { backoffBaseMs: sync.backoffBaseMs, backoffMaxMs: sync.backoffMaxMs, backoffFactor: sync.backoffFactor, batchSize: sync.batchSize }
        : undefined,
    };
  }

  private pendingRefinement(farmId: string): Promise<number> {
    return pendingRefinementQuery(this.observations).andWhere('o.farmId = :farmId', { farmId }).getCount();
  }

  private async catalogVersion(farmId: string): Promise<number> {
    const farm = await this.farms.findOneBy({ id: farmId });
    const region = farm?.regionCode ?? this.config.get('catalog', { infer: true }).defaultRegion;
    return (await this.catalogState.findOneBy({ regionCode: region }))?.version ?? 0;
  }
}
