import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities';
import { FieldLinkMethod } from '../../../domain/enums';
import { FieldLocatorService } from '../../fields/field-locator.service';
import { WeatherService } from '../../weather/weather.service';
import { ObservationPayloadDto } from '../dto/payloads.dto';

export interface ObservationEnrichment {
  fieldId: string | null;
  fieldLinkMethod: FieldLinkMethod;
  lat: number | null;
  lng: number | null;
  gpsAccuracyM: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
}

/** Server-side completion of a pushed observation: field link (FR-21), weather fill (FR-5), geo opt-out (spec section 7). */
@Injectable()
export class ObservationEnricher {
  private readonly logger = new Logger(ObservationEnricher.name);

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly locator: FieldLocatorService,
    private readonly weather: WeatherService,
  ) {}

  async enrich(farmId: string, userId: string, p: ObservationPayloadDto): Promise<ObservationEnrichment> {
    const hasPoint = p.lat !== undefined && p.lng !== undefined;
    const link = !hasPoint ? null : await this.linkField(farmId, p);
    const weather = !hasPoint ? null : await this.currentWeather(p);
    const keepPoint = hasPoint && await this.mayStorePoint(userId);
    return {
      fieldId: p.fieldId ?? link ?? null,
      fieldLinkMethod: p.fieldLinkMethod ?? (!p.fieldId && link ? FieldLinkMethod.Gps : FieldLinkMethod.None),
      lat: keepPoint ? p.lat! : null,
      lng: keepPoint ? p.lng! : null,
      gpsAccuracyM: keepPoint ? p.gpsAccuracyM ?? null : null,
      temperatureC: p.temperatureC ?? weather?.temperatureC ?? null,
      humidityPct: p.humidityPct ?? weather?.humidityPct ?? null,
    };
  }

  private async linkField(farmId: string, p: ObservationPayloadDto): Promise<string | null> {
    if (p.fieldId) return null;
    const { matches } = await this.locator.locate(farmId, p.lat!, p.lng!);
    return matches.length === 1 ? matches[0].fieldId : null;
  }

  /** shortcut: current conditions rather than those at capture time; upgrade with an archive lookup if offline delays grow. */
  private async currentWeather(p: ObservationPayloadDto) {
    if (p.temperatureC !== undefined && p.humidityPct !== undefined) return null;
    try {
      return await this.weather.getCurrent(p.lat!, p.lng!);
    } catch (error) {
      this.logger.warn(`weather auto-fill skipped: ${(error as Error).message}`);
      return null;
    }
  }

  private async mayStorePoint(userId: string): Promise<boolean> {
    return (await this.users.findOneBy({ id: userId }))?.geoCollectionEnabled ?? false;
  }
}
