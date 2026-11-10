import { HourlyWeather, SprayConstraints } from './weather.types';

export interface SprayRule {
  /** Returns an i18n cause code when the hour blocks spraying, otherwise null. */
  cause(hour: HourlyWeather, limits: SprayConstraints): string | null;
}

const rule = (code: string, blocked: (h: HourlyWeather, l: SprayConstraints) => boolean): SprayRule => ({
  cause: (hour, limits) => (blocked(hour, limits) ? code : null),
});

function isRainy(h: HourlyWeather, l: SprayConstraints): boolean {
  return h.precipitationMm > l.maxRainMm || h.precipitationProbPct > l.maxPrecipProbPct;
}

export const SPRAY_RULES: readonly SprayRule[] = [
  rule('weather.cause.wind_high', (h, l) => h.windSpeedMs > l.maxWindMs),
  rule('weather.cause.gust_high', (h, l) => l.maxGustMs !== undefined && h.windGustMs > l.maxGustMs),
  rule('weather.cause.temp_low', (h, l) => h.temperatureC < l.minTempC),
  rule('weather.cause.temp_high', (h, l) => h.temperatureC > l.maxTempC),
  rule('weather.cause.humidity_low', (h, l) => l.minHumidityPct !== undefined && h.humidityPct < l.minHumidityPct),
  rule('weather.cause.humidity_high', (h, l) => l.maxHumidityPct !== undefined && h.humidityPct > l.maxHumidityPct),
  rule('weather.cause.rain_now', (h, l) => isRainy(h, l)),
];

export const RAIN_EXPECTED_CAUSE = 'weather.cause.rain_expected';

export function isRainExpected(upcoming: HourlyWeather[], limits: SprayConstraints): boolean {
  return upcoming.some((h) => isRainy(h, limits));
}
