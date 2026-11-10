import { OpenMeteoClient } from './open-meteo.client';

const cfg = { providerUrl: 'https://example.test/forecast', horizonHours: 2, timeoutMs: 1000 };
const client = new OpenMeteoClient({ get: () => cfg } as never);

describe('OpenMeteoClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps the hourly arrays to hourly records with ISO UTC times', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ['2026-11-10T00:00', '2026-11-10T01:00'], temperature_2m: [10, 11], relative_humidity_2m: [50, 55],
          wind_speed_10m: [2, 3], wind_gusts_10m: [4, 5], precipitation: [0, 1.2], precipitation_probability: [10, null],
        },
      }),
    } as Response);
    const hourly = await client.fetchHourly(50.45, 30.52);
    expect(hourly[1]).toEqual({
      time: '2026-11-10T01:00:00.000Z', temperatureC: 11, humidityPct: 55, windSpeedMs: 3, windGustMs: 5,
      precipitationMm: 1.2, precipitationProbPct: 0,
    });
    expect(String(spy.mock.calls[0][0])).toContain('forecast_hours=2');
  });

  it('rejects on a non-2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(client.fetchHourly(1, 1)).rejects.toThrow('500');
  });
});
