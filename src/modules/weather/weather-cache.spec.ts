import { WeatherCache } from './weather-cache';

describe('WeatherCache', () => {
  it('returns undefined for an unknown key', () => {
    expect(new WeatherCache().get('1,1')).toBeUndefined();
  });

  it('stores and returns an entry with its fetch time', () => {
    const cache = new WeatherCache();
    cache.set('1,1', [], 42);
    expect(cache.get('1,1')).toEqual({ fetchedAt: 42, hourly: [] });
  });
});
