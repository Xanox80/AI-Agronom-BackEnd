import { ConfigService } from '@nestjs/config';
import { AnalyticsSettings } from './analytics.settings';

const settingsFrom = (env: Record<string, string>) => new AnalyticsSettings(new ConfigService(env));

describe('AnalyticsSettings', () => {
  it('falls back to defaults', () => {
    expect(settingsFrom({})).toMatchObject({ maxRows: 20_000, confirmedWeight: 1 });
  });

  it('reads overrides from the environment', () => {
    expect(settingsFrom({ ANALYTICS_MAX_ROWS: '50', ANALYTICS_CONFIRMED_WEIGHT: '0.9' }))
      .toMatchObject({ maxRows: 50, confirmedWeight: 0.9 });
  });
});
