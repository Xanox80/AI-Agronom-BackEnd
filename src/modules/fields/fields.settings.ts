import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const METERS_PER_KM = 1000;
const BYTES_PER_MB = 1024 * 1024;

/** Reads the FIELDS_* tunables from the environment (documented in .env.example); a missing or invalid key fails fast. */
@Injectable()
export class FieldsSettings {
  constructor(private readonly config: ConfigService) {}

  get nearbyLimit(): number {
    return this.positive('FIELDS_NEARBY_LIMIT');
  }

  get nearbyMaxMeters(): number {
    return this.positive('FIELDS_NEARBY_MAX_KM') * METERS_PER_KM;
  }

  get importMaxBytes(): number {
    return this.positive('FIELDS_IMPORT_MAX_MB') * BYTES_PER_MB;
  }

  get importMaxUnzippedBytes(): number {
    return this.positive('FIELDS_IMPORT_MAX_UNZIPPED_MB') * BYTES_PER_MB;
  }

  get importFallbackName(): string {
    return this.config.getOrThrow<string>('FIELDS_IMPORT_FALLBACK_NAME');
  }

  get defaultPageSize(): number {
    return this.positive('FIELDS_DEFAULT_PAGE_SIZE');
  }

  get maxPageSize(): number {
    return this.positive('FIELDS_MAX_PAGE_SIZE');
  }

  get nameMaxLength(): number {
    return this.positive('FIELDS_NAME_MAX_LENGTH');
  }

  private positive(key: string): number {
    const value = Number(this.config.getOrThrow<string>(key));
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a positive number`);
    return value;
  }
}
