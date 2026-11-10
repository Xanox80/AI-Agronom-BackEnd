import { ConfigService } from '@nestjs/config';
import { SyncSettings } from './sync.settings';

const settingsOf = (values: Record<string, unknown>) => new SyncSettings(new ConfigService(values));

describe('SyncSettings', () => {
  it('reads the pull page size and clock skew tolerance as numbers', () => {
    const settings = settingsOf({ SYNC_PULL_PAGE_SIZE: '200', SYNC_CLOCK_SKEW_MS: '120000' });

    expect(settings.pullPageSize).toBe(200);
    expect(settings.clockSkewMs).toBe(120000);
  });

  it('fails fast on a missing key', () => {
    expect(() => settingsOf({}).pullPageSize).toThrow();
  });

  it('fails fast on a non-positive value', () => {
    expect(() => settingsOf({ SYNC_CLOCK_SKEW_MS: '0' }).clockSkewMs).toThrow(/positive/);
  });
});
