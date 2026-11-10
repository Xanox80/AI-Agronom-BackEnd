import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MAX_EXPORT_ROWS = 20_000;
const DEFAULT_CONFIRMED_WEIGHT = 1;

/** Analytics tunables. Row cap stays below SQLite's bound-variable limit (32766) because ids are bound in IN(...). */
@Injectable()
export class AnalyticsSettings {
  readonly maxRows: number;
  readonly confirmedWeight: number;

  constructor(config: ConfigService) {
    this.maxRows = Number(config.get('ANALYTICS_MAX_ROWS') ?? DEFAULT_MAX_EXPORT_ROWS);
    this.confirmedWeight = Number(config.get('ANALYTICS_CONFIRMED_WEIGHT') ?? DEFAULT_CONFIRMED_WEIGHT);
  }
}
