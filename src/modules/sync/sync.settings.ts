import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Reads the SYNC_PULL_PAGE_SIZE and SYNC_CLOCK_SKEW_MS tunables (documented in .env.example); a missing or invalid key fails fast. */
@Injectable()
export class SyncSettings {
  constructor(private readonly config: ConfigService) {}

  get pullPageSize(): number {
    return this.positive('SYNC_PULL_PAGE_SIZE');
  }

  get clockSkewMs(): number {
    return this.positive('SYNC_CLOCK_SKEW_MS');
  }

  private positive(key: string): number {
    const value = Number(this.config.getOrThrow<string | number>(key));
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a positive number`);
    return value;
  }
}
