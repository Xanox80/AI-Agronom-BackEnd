import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { DEMO_FARM_SEEDED, DemoFarmSeededEvent } from '../../domain/demo-events';
import { FarmEntity, ProductEntity, StockItemEntity } from '../../domain/entities';
import { StockSettings } from './stock.settings';


/** Gives every farm without stock rows demo levels for demo products; every Nth product stays out of stock. */
@Injectable()
export class StockDemoSeeder implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly settings: StockSettings,
    @InjectRepository(StockItemEntity) private readonly items: Repository<StockItemEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(FarmEntity) private readonly farms: Repository<FarmEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const farm of await this.farms.find()) await this.seedFarm(farm.id);
  }

  @OnEvent(DEMO_FARM_SEEDED)
  async seedFarm(farmId: string | DemoFarmSeededEvent): Promise<void> {
    const id = typeof farmId === 'string' ? farmId : farmId.farmId;
    if (!this.config.get('catalog', { infer: true }).seedDemo) return;
    if (await this.items.exist({ where: { farmId: id } })) return;
    const demo = await this.products.find({ where: { isDemo: true }, order: { name: 'ASC' } });
    const stocked = demo.filter((_, i) => (i + 1) % this.settings.demoOutOfStockEveryNth !== 0);
    await this.items.save(stocked.map((p, i) => this.items.create({
      farmId: id, productId: p.id, quantity: this.settings.demoBaseQuantity + i * this.settings.demoQuantityStep, unit: this.settings.demoUnit,
    })));
  }
}
