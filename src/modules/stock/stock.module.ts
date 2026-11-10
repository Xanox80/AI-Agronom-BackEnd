import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmEntity, ProductEntity, StockItemEntity } from '../../domain/entities';
import { LocalStockProvider } from './local-stock.provider';
import { STOCK_PROVIDER } from './stock-provider';
import { StockController } from './stock.controller';
import { StockDemoSeeder } from './stock-demo-seeder';
import { StockService } from './stock.service';
import { StockSettings } from './stock.settings';

@Module({
  imports: [TypeOrmModule.forFeature([StockItemEntity, ProductEntity, FarmEntity])],
  controllers: [StockController],
  providers: [StockService, StockSettings, StockDemoSeeder, { provide: STOCK_PROVIDER, useClass: LocalStockProvider }],
  exports: [StockService, STOCK_PROVIDER],
})
export class StockModule {}
