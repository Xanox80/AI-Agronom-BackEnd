import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { OpenMeteoClient } from './open-meteo.client';
import { SprayWindowEvaluator } from './spray-window.evaluator';
import { WeatherClock } from './weather-clock';
import { CacheEntry, WeatherCache } from './weather-cache';
import { CurrentWeather, SprayConstraints, WeatherForecast, WeatherWindow } from './weather.types';

const MS_PER_MINUTE = 60_000;

@Injectable()
export class WeatherService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly client: OpenMeteoClient,
    private readonly cache: WeatherCache,
    private readonly evaluator: SprayWindowEvaluator,
    private readonly clock: WeatherClock,
  ) {}

  async getForecast(lat: number, lng: number, hours?: number): Promise<WeatherForecast> {
    const { horizonHours } = this.config.get('weather', { infer: true });
    const limit = Math.min(hours ?? horizonHours, horizonHours);
    const { fetchedAt, hourly, cached } = await this.loadHourly(lat, lng);
    return { fetchedAt: new Date(fetchedAt).toISOString(), source: 'open-meteo', cached, hourly: hourly.slice(0, limit) };
  }

  async getCurrent(lat: number, lng: number): Promise<CurrentWeather> {
    const [now] = (await this.getForecast(lat, lng, 1)).hourly;
    if (!now) throw new ServiceUnavailableException({ code: 'WEATHER_UNAVAILABLE' });
    return { time: now.time, temperatureC: now.temperatureC, humidityPct: now.humidityPct, windSpeedMs: now.windSpeedMs };
  }

  evaluateWindow(forecast: WeatherForecast, constraints?: Partial<SprayConstraints>): WeatherWindow {
    return this.evaluator.evaluate(forecast.hourly, constraints);
  }

  private async loadHourly(lat: number, lng: number): Promise<CacheEntry & { cached: boolean }> {
    const { cacheTtlMinutes, cacheCoordPrecision } = this.config.get('weather', { infer: true });
    const key = `${lat.toFixed(cacheCoordPrecision)},${lng.toFixed(cacheCoordPrecision)}`;
    const entry = this.cache.get(key);
    if (entry && this.clock.now() - entry.fetchedAt < cacheTtlMinutes * MS_PER_MINUTE) return { ...entry, cached: true };
    try {
      const hourly = await this.client.fetchHourly(lat, lng);
      const fetchedAt = this.clock.now();
      this.cache.set(key, hourly, fetchedAt);
      return { fetchedAt, hourly, cached: false };
    } catch {
      if (entry) return { ...entry, cached: true };
      throw new ServiceUnavailableException({ code: 'WEATHER_UNAVAILABLE', message: 'weather.error.unavailable' });
    }
  }
}
