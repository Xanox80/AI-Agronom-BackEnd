import { WeatherVerdict } from '../../domain/enums';
import { SprayWindowEvaluator } from './spray-window.evaluator';
import { HourlyWeather } from './weather.types';

const limits = {
  maxWindMs: 5, minTempC: 5, maxTempC: 25, maxRainMm: 0.5, rainFreeHours: 2, maxPrecipProbPct: 40, minHumidityPct: 30, maxHumidityPct: 90,
};
const evaluator = new SprayWindowEvaluator({ get: () => limits } as never);

const hour = (i: number, over: Partial<HourlyWeather> = {}): HourlyWeather => ({
  time: `2026-11-10T${String(i).padStart(2, '0')}:00:00.000Z`,
  temperatureC: 15, humidityPct: 60, windSpeedMs: 2, windGustMs: 3, precipitationMm: 0, precipitationProbPct: 0, ...over,
});

describe('SprayWindowEvaluator', () => {
  it('returns go when the current hour and the rain-free hours after it are calm', () => {
    const result = evaluator.evaluate([hour(0), hour(1), hour(2)]);
    expect(result.verdict).toBe(WeatherVerdict.Go);
    expect(result.reason).toBe('weather.window.go');
  });

  it('returns no_go with causes when no hour in the horizon is suitable', () => {
    const result = evaluator.evaluate([hour(0, { windSpeedMs: 9 }), hour(1, { temperatureC: 2 })]);
    expect(result.verdict).toBe(WeatherVerdict.NoGo);
    expect(result.reasonParams).toEqual({ causes: ['weather.cause.wind_high'] });
    expect(result.hours[1].causes).toEqual(['weather.cause.temp_low']);
  });

  it('returns wait with nextGoAt when a suitable hour comes later', () => {
    const result = evaluator.evaluate([hour(0, { temperatureC: 30 }), hour(1)]);
    expect(result.verdict).toBe(WeatherVerdict.Wait);
    expect(result.nextGoAt).toBe(hour(1).time);
    expect(result.reasonParams).toMatchObject({ causes: ['weather.cause.temp_high'] });
  });

  it('marks an hour as wait when rain is expected within the rain-free hours', () => {
    const result = evaluator.evaluate([hour(0), hour(1, { precipitationMm: 2 }), hour(2), hour(3)]);
    expect(result.hours[0]).toMatchObject({ verdict: WeatherVerdict.Wait, causes: ['weather.cause.rain_expected'] });
    expect(result.hours[1].causes).toEqual(['weather.cause.rain_now']);
    expect(result.hours[3].verdict).toBe(WeatherVerdict.Go);
  });

  it('treats high precipitation probability as expected rain', () => {
    const result = evaluator.evaluate([hour(0), hour(1, { precipitationProbPct: 80 })]);
    expect(result.hours[0].verdict).toBe(WeatherVerdict.Wait);
  });

  it('blocks the current hour on high precipitation probability even with no rain volume', () => {
    const result = evaluator.evaluate([hour(0, { precipitationProbPct: 80 })]);
    expect(result.hours[0]).toMatchObject({ verdict: WeatherVerdict.NoGo, causes: ['weather.cause.rain_now'] });
  });

  it('blocks hours with humidity outside the configured range', () => {
    const result = evaluator.evaluate([hour(0, { humidityPct: 10 }), hour(1, { humidityPct: 95 })]);
    expect(result.hours[0].causes).toEqual(['weather.cause.humidity_low']);
    expect(result.hours[1].causes).toEqual(['weather.cause.humidity_high']);
  });

  it('blocks hours whose wind gusts exceed the limit', () => {
    const gusty = new SprayWindowEvaluator({ get: () => ({ ...limits, maxGustMs: 8 }) } as never);
    const result = gusty.evaluate([hour(0, { windGustMs: 12 })]);
    expect(result.hours[0].causes).toContain('weather.cause.gust_high');
  });

  it('skips humidity rules when no humidity limits are configured', () => {
    const open = new SprayWindowEvaluator({ get: () => ({ ...limits, minHumidityPct: undefined, maxHumidityPct: undefined }) } as never);
    expect(open.evaluate([hour(0, { humidityPct: 1 })]).verdict).toBe(WeatherVerdict.Go);
  });

  it('applies request constraints over configured limits and ignores undefined ones', () => {
    const result = evaluator.evaluate([hour(0, { windSpeedMs: 7 })], { maxWindMs: 8, minTempC: undefined });
    expect(result.verdict).toBe(WeatherVerdict.Go);
  });

  it('returns no_go without hours', () => {
    expect(evaluator.evaluate([]).reason).toBe('weather.window.no_data');
  });
});
