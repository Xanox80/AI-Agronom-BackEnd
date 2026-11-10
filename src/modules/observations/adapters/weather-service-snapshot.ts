import { Injectable } from '@nestjs/common';
import { WeatherService } from '../../weather/weather.service';
import { WeatherSnapshot, WeatherSnapshotProvider } from '../ports/weather-snapshot.port';

/** Backs the observation weather port with the weather module; an unavailable provider just means no auto-fill. */
@Injectable()
export class WeatherServiceSnapshot implements WeatherSnapshotProvider {
  constructor(private readonly weather: WeatherService) {}

  async at(lat: number, lng: number): Promise<WeatherSnapshot | null> {
    try {
      const { temperatureC, humidityPct } = await this.weather.getCurrent(lat, lng);
      return { temperatureC, humidityPct };
    } catch {
      return null;
    }
  }
}
