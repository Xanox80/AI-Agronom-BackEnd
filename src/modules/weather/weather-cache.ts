import { Injectable } from '@nestjs/common';
import { HourlyWeather } from './weather.types';

export interface CacheEntry {
  fetchedAt: number;
  hourly: HourlyWeather[];
}

// shortcut: in-process map, lost on restart and per instance; move to a shared store if the API is scaled out.
@Injectable()
export class WeatherCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, hourly: HourlyWeather[], fetchedAt: number): void {
    this.entries.set(key, { fetchedAt, hourly });
  }
}
