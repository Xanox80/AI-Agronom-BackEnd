import { WeatherVerdict } from '../../../domain/enums';
import { WeatherService } from '../../weather/weather.service';
import { candidate, contextFor, registration, settings } from '../__fixtures__/pipeline-fixtures';
import { SafetyWeatherStep } from './safety-weather.step';

const window = { verdict: WeatherVerdict.Go, reason: 'weather.go', reasonParams: {}, hours: [] };

function stepWith(weather: Partial<Record<keyof WeatherService, jest.Mock>>) {
  return new SafetyWeatherStep(settings(), weather as unknown as WeatherService);
}

const goodWeather = () => ({ getForecast: jest.fn().mockResolvedValue({ hourly: [] }), evaluateWindow: jest.fn().mockReturnValue(window) });

describe('SafetyWeatherStep', () => {
  it('evaluates the weather window for the configured horizon', async () => {
    const weather = goodWeather();
    const context = contextFor();
    context.candidates = [candidate()];
    await stepWith(weather).run(context);
    expect(weather.getForecast).toHaveBeenCalledWith(50, 30, 72);
    expect(context.weather?.verdict).toBe(WeatherVerdict.Go);
  });

  it('passes the strictest label limits of eligible products to the window evaluation', async () => {
    const weather = goodWeather();
    const context = contextFor();
    context.candidates = [
      candidate({ registration: registration({ maxWindSpeedMs: 4, minTempC: 8, maxTempC: 30 }) }),
      candidate({ registration: registration({ id: 'r2', maxWindSpeedMs: 3, minTempC: 5, maxTempC: 25 }) }),
      candidate({ registration: registration({ id: 'r3', maxWindSpeedMs: 1 }), exclusion: { code: 'bbch_window', params: {} } }),
    ];
    await stepWith(weather).run(context);
    expect(weather.evaluateWindow).toHaveBeenCalledWith({ hourly: [] }, { maxWindMs: 3, minTempC: 8, maxTempC: 25 });
  });

  it('adds safety warnings only for eligible products', async () => {
    const context = contextFor({ field: { id: 'f', areaHa: 1, sowingDate: null, nearWater: true, nearApiary: false, nearSettlement: false } });
    context.candidates = [candidate({ exclusion: { code: 'rotation_limit', params: {} } })];
    await stepWith(goodWeather()).run(context);
    expect(context.warnings).toEqual([]);
  });

  it('warns instead of failing when the weather service is down', async () => {
    const context = contextFor();
    context.candidates = [candidate()];
    await stepWith({ getForecast: jest.fn().mockRejectedValue(new Error('503')), evaluateWindow: jest.fn() }).run(context);
    expect(context.weather).toBeNull();
    expect(context.warnings.map((w) => w.code)).toContain('weather_unavailable');
  });

  it('warns when there are no coordinates', async () => {
    const weather = goodWeather();
    const context = contextFor({ location: null });
    context.candidates = [candidate()];
    await stepWith(weather).run(context);
    expect(weather.getForecast).not.toHaveBeenCalled();
    expect(context.warnings.map((w) => w.code)).toContain('weather_location_missing');
  });
});
