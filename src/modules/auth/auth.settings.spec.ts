import { ConfigService } from '@nestjs/config';
import { DEV_DEMO_PASSWORD } from './auth.constants';
import { AuthSettings } from './auth.settings';

const settingsFor = (env: string, demoPassword?: string) => new AuthSettings({
  get: (key: string) => (key === 'DEMO_USER_PASSWORD' ? demoPassword : undefined),
  getOrThrow: () => ({ env }),
} as unknown as ConfigService);

describe('AuthSettings.demoPassword', () => {
  it('uses the configured password', () => {
    expect(settingsFor('production', 'from-config').demoPassword).toBe('from-config');
  });

  it('falls back to the dev password outside production', () => {
    expect(settingsFor('development').demoPassword).toBe(DEV_DEMO_PASSWORD);
  });

  it('refuses to start seeding in production without a configured password', () => {
    expect(() => settingsFor('production').demoPassword).toThrow('DEMO_USER_PASSWORD');
  });
});
