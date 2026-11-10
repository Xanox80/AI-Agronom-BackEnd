import { WeatherVerdict } from '../../domain/enums';

export interface HourlyWeather {
  time: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedMs: number;
  windGustMs: number;
  precipitationMm: number;
  precipitationProbPct: number;
}

export interface WeatherForecast {
  fetchedAt: string;
  source: 'open-meteo';
  cached: boolean;
  hourly: HourlyWeather[];
}

export interface CurrentWeather {
  time: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedMs: number;
}

export interface SprayConstraints {
  maxWindMs: number;
  maxGustMs?: number;
  minTempC: number;
  maxTempC: number;
  maxRainMm: number;
  rainFreeHours: number;
  maxPrecipProbPct: number;
  minHumidityPct?: number;
  maxHumidityPct?: number;
}

export interface HourVerdict {
  time: string;
  verdict: WeatherVerdict;
  causes: string[];
}

export interface WeatherWindow {
  verdict: WeatherVerdict;
  reason: string;
  reasonParams: Record<string, unknown>;
  nextGoAt?: string;
  hours: HourVerdict[];
}
