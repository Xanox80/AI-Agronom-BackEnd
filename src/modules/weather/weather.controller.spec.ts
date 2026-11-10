import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Role } from '../../domain/enums';
import { ROLES_KEY } from '../auth/auth.constants';
import { ForecastQueryDto, WindowRequestDto } from './dto/weather.dto';
import { WeatherController } from './weather.controller';

describe('WeatherController', () => {
  const forecast = { hourly: [] };
  const weather = {
    getForecast: jest.fn().mockResolvedValue(forecast),
    getCurrent: jest.fn().mockResolvedValue({ time: 't' }),
    evaluateWindow: jest.fn().mockReturnValue({ verdict: 'go' }),
  };
  const controller = new WeatherController(weather as never);

  it('delegates forecast with lat, lng and hours', async () => {
    await controller.forecast({ lat: 1, lng: 2, hours: 5 });
    expect(weather.getForecast).toHaveBeenCalledWith(1, 2, 5);
  });

  it('delegates current conditions', async () => {
    expect(await controller.current({ lat: 1, lng: 2 })).toEqual({ time: 't' });
  });

  it('evaluates the window on the forecast with request constraints', async () => {
    const constraints = { maxWindMs: 3 };
    expect(await controller.window({ lat: 1, lng: 2, constraints })).toEqual({ verdict: 'go' });
    expect(weather.evaluateWindow).toHaveBeenCalledWith(forecast, constraints);
  });

  it('restricts the window route to scouts and chief agronomists', () => {
    expect(Reflect.getMetadata(ROLES_KEY, WeatherController.prototype.window)).toEqual([Role.Scout, Role.ChiefAgronomist]);
  });

  it('leaves forecast and current open to any authenticated role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, WeatherController.prototype.forecast)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, WeatherController.prototype.current)).toBeUndefined();
  });

  it('rejects out-of-range coordinates and accepts valid ones', async () => {
    expect(await validate(plainToInstance(ForecastQueryDto, { lat: '95', lng: '10' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(ForecastQueryDto, { lat: '50', lng: '10', hours: '24' }))).toHaveLength(0);
  });

  it('rejects humidity limits above 100 percent', async () => {
    const dto = plainToInstance(WindowRequestDto, { lat: 1, lng: 1, constraints: { maxHumidityPct: 150 } });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
