import { ConfigService } from '@nestjs/config';
import { StockSettings } from './stock.settings';

const settings = (env: Record<string, string>) => new StockSettings({ get: (k: string) => env[k] } as ConfigService);

describe('StockSettings', () => {
  it('falls back to defaults when keys are missing or invalid', () => {
    expect(settings({}).maxPageSize).toBe(100);
    expect(settings({ STOCK_MAX_PAGE_SIZE: 'abc' }).maxPageSize).toBe(100);
    expect(settings({}).demoUnit).toBe('l');
  });

  it('reads overrides from the environment', () => {
    expect(settings({ STOCK_DEFAULT_PAGE_SIZE: '5' }).defaultPageSize).toBe(5);
    expect(settings({ STOCK_DEMO_UNIT: 'kg' }).demoUnit).toBe('kg');
  });
});
