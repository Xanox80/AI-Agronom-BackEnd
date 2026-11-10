import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Single access point for stock tunables; keys are read from the environment with documented defaults. */
@Injectable()
export class StockSettings {
  constructor(private readonly config: ConfigService) {}

  get defaultPageSize(): number { return this.number('STOCK_DEFAULT_PAGE_SIZE', 20); }
  get maxPageSize(): number { return this.number('STOCK_MAX_PAGE_SIZE', 100); }
  get maxImportKb(): number { return this.number('STOCK_IMPORT_MAX_KB', 512); }
  get demoUnit(): string { return this.config.get<string>('STOCK_DEMO_UNIT') || 'l'; }
  get demoBaseQuantity(): number { return this.number('STOCK_DEMO_BASE_QUANTITY', 200); }
  get demoQuantityStep(): number { return this.number('STOCK_DEMO_QUANTITY_STEP', 150); }
  get demoOutOfStockEveryNth(): number { return this.number('STOCK_DEMO_OUT_OF_STOCK_EVERY_NTH', 3); }

  private number(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
  }
}
