import { ServiceUnavailableException } from '@nestjs/common';
import { WeatherCache } from './weather-cache';
import { WeatherService } from './weather.service';
import { HourlyWeather } from './weather.types';

const cfg = { horizonHours: 3, cacheTtlMinutes: 60, cacheCoordPrecision: 2 };
const hourly: HourlyWeather[] = [0, 1, 2, 3].map((i) => ({
  time: `2026-11-10T0${i}:00:00.000Z`, temperatureC: 10 + i, humidityPct: 50, windSpeedMs: 1, windGustMs: 2,
  precipitationMm: 0, precipitationProbPct: 0,
}));

describe('WeatherService', () => {
  let fetchHourly: jest.Mock;
  let service: WeatherService;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    fetchHourly = jest.fn().mockResolvedValue(hourly);
    service = new WeatherService({ get: () => cfg } as never, { fetchHourly } as never, new WeatherCache(), { evaluate: jest.fn() } as never, { now: () => now } as never);
  });

  it('caps the returned hours at the configured horizon', async () => {
    const forecast = await service.getForecast(50.4501, 30.5234, 100);
    expect(forecast.hourly).toHaveLength(3);
    expect(forecast.cached).toBe(false);
  });

  it('serves nearby coordinates from the cache within the TTL', async () => {
    await service.getForecast(50.4501, 30.5234);
    const second = await service.getForecast(50.4502, 30.5233);
    expect(fetchHourly).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });

  it('refetches after the TTL expires', async () => {
    await service.getForecast(50.45, 30.52);
    now += 61 * 60_000;
    await service.getForecast(50.45, 30.52);
    expect(fetchHourly).toHaveBeenCalledTimes(2);
  });

  it('serves the stale cache when the provider fails', async () => {
    await service.getForecast(50.45, 30.52);
    now += 61 * 60_000;
    fetchHourly.mockRejectedValue(new Error('down'));
    expect((await service.getForecast(50.45, 30.52)).cached).toBe(true);
  });

  it('throws WEATHER_UNAVAILABLE when the provider fails and nothing is cached', async () => {
    fetchHourly.mockRejectedValue(new Error('down'));
    await expect(service.getForecast(1, 1)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns the first forecast hour as current conditions', async () => {
    expect(await service.getCurrent(50.45, 30.52)).toEqual({ time: hourly[0].time, temperatureC: 10, humidityPct: 50, windSpeedMs: 1 });
  });
});
