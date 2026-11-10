import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { HourlyWeather } from './weather.types';

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  precipitation: number[];
  precipitation_probability: number[];
}

const HOURLY_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_gusts_10m', 'precipitation', 'precipitation_probability',
];

@Injectable()
export class OpenMeteoClient {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async fetchHourly(lat: number, lng: number): Promise<HourlyWeather[]> {
    const { providerUrl, horizonHours, timeoutMs } = this.config.get('weather', { infer: true });
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: HOURLY_FIELDS.join(','),
      wind_speed_unit: 'ms',
      timezone: 'GMT',
      forecast_hours: String(horizonHours),
    });
    const response = await fetch(`${providerUrl}?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}`);
    const body = (await response.json()) as { hourly?: OpenMeteoHourly };
    if (!body.hourly) throw new Error('Open-Meteo response has no hourly block');
    return this.mapHourly(body.hourly);
  }

  private mapHourly(h: OpenMeteoHourly): HourlyWeather[] {
    return h.time.map((time, i) => ({
      time: new Date(`${time}Z`).toISOString(),
      temperatureC: h.temperature_2m[i],
      humidityPct: h.relative_humidity_2m[i],
      windSpeedMs: h.wind_speed_10m[i],
      windGustMs: h.wind_gusts_10m[i],
      precipitationMm: h.precipitation[i] ?? 0,
      precipitationProbPct: h.precipitation_probability[i] ?? 0,
    }));
  }
}
