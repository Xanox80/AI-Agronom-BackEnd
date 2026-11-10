import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { CatalogStateEntity, ProductEntity } from '../../domain/entities';
import { MS_PER_DAY } from './catalog.constants';
import type { CatalogStatusDto } from './dto/catalog.dto';

const DATE_LENGTH = 'YYYY-MM-DD'.length;
const daysBetween = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

/** Catalogue version and the stale-data warning (spec section 10). */
@Injectable()
export class CatalogStatusService {
  constructor(
    @InjectRepository(CatalogStateEntity) private readonly states: Repository<CatalogStateEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Falls back to the default region when the requested one has no pack of its own. */
  async requireState(regionCode?: string): Promise<CatalogStateEntity> {
    const { defaultRegion } = this.config.get('catalog', { infer: true });
    const state = (regionCode && (await this.states.findOneBy({ regionCode }))) || (await this.states.findOneBy({ regionCode: defaultRegion }));
    if (!state) throw new NotFoundException({ code: 'CATALOG_NOT_PUBLISHED', message: 'Catalogue has not been published' });
    return state;
  }

  async getStatus(regionCode?: string, now = new Date()): Promise<CatalogStatusDto> {
    const state = await this.requireState(regionCode);
    const { staleDays } = this.config.get('catalog', { infer: true });
    const daysSinceVerified = daysBetween(state.lastVerifiedAt, now);
    const oldestRow = await this.oldestProductVerification();
    const oldestRowDays = oldestRow ? daysBetween(new Date(oldestRow), now) : 0;
    return {
      regionCode: state.regionCode, version: state.version, publishedAt: state.publishedAt.toISOString(),
      lastVerifiedAt: state.lastVerifiedAt.toISOString(), daysSinceVerified, stale: Math.max(daysSinceVerified, oldestRowDays) > staleDays,
      oldestRowVerifiedAt: oldestRow,
      staleAfterDays: staleDays, containsDemoData: await this.products.existsBy({ isDemo: true }),
    };
  }

  private async oldestProductVerification(): Promise<string | null> {
    const raw = await this.products.createQueryBuilder('p').select('MIN(p.verifiedAt)', 'oldest').getRawOne<{ oldest: string | null }>();
    return raw?.oldest ?? null;
  }

  async markVerified(regionCode: string, now = new Date()): Promise<CatalogStatusDto> {
    const state = await this.requireState(regionCode);
    await this.states.update({ regionCode: state.regionCode }, { lastVerifiedAt: now });
    await this.products.createQueryBuilder().update().set({ verifiedAt: now.toISOString().slice(0, DATE_LENGTH) }).execute();
    return this.getStatus(state.regionCode, now);
  }

  /** shortcut: one global version shared by all regions, so every state moves together; split per region when packs diverge */
  async bumpVersion(manager: EntityManager): Promise<number> {
    await manager.createQueryBuilder().update(CatalogStateEntity)
      .set({ version: () => 'version + 1', publishedAt: new Date() }).execute();
    const { defaultRegion } = this.config.get('catalog', { infer: true });
    const state = await manager.findOneByOrFail(CatalogStateEntity, { regionCode: defaultRegion });
    return state.version;
  }
}
