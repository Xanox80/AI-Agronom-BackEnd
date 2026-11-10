import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { DEFAULT_DEMO_FARM_NAME, DEV_DEMO_PASSWORD } from './auth.constants';

/** Single access point for auth tunables; keys not yet in AppConfig are read from the environment. */
@Injectable()
export class AuthSettings {
  constructor(private readonly config: ConfigService) {}

  get auth(): AppConfig['auth'] {
    return this.config.getOrThrow<AppConfig['auth']>('auth');
  }

  get apiPrefix(): string {
    return this.config.getOrThrow<AppConfig['app']>('app').apiPrefix;
  }

  get production(): boolean {
    return this.config.getOrThrow<AppConfig['app']>('app').env === 'production';
  }

  get seedDemoUsers(): boolean {
    const raw = this.config.get<string>('AUTH_SEED_DEMO_USERS');
    return raw === undefined || raw === '' ? !this.production : raw.toLowerCase() === 'true';
  }

  get demoPassword(): string {
    const configured = this.config.get<string>('DEMO_USER_PASSWORD');
    if (configured) return configured;
    if (this.production) throw new Error('DEMO_USER_PASSWORD is required when demo users are seeded in production');
    return DEV_DEMO_PASSWORD;
  }

  get demoFarmName(): string {
    return this.config.get<string>('DEMO_FARM_NAME') || DEFAULT_DEMO_FARM_NAME;
  }

  get defaultRegion(): string {
    return this.config.getOrThrow<AppConfig['catalog']>('catalog').defaultRegion;
  }

  get safetyBuffers(): AppConfig['safety'] {
    return this.config.getOrThrow<AppConfig['safety']>('safety');
  }
}
