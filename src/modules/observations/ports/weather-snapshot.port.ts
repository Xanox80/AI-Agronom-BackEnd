export interface WeatherSnapshot { temperatureC: number; humidityPct: number }

/** Current conditions at a point, backed by the weather module (FR-5). */
export interface WeatherSnapshotProvider {
  at(lat: number, lng: number): Promise<WeatherSnapshot | null>;
}

export const WEATHER_SNAPSHOT = Symbol('WEATHER_SNAPSHOT');
