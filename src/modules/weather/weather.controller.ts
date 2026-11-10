import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoordinatesQueryDto, ForecastQueryDto, WindowRequestDto } from './dto/weather.dto';
import { WeatherService } from './weather.service';

@ApiTags('weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('forecast')
  @ApiOperation({ summary: 'Hourly forecast (wind, temperature, precipitation, humidity)' })
  forecast(@Query() q: ForecastQueryDto) {
    return this.weather.getForecast(q.lat, q.lng, q.hours);
  }

  @Get('current')
  @ApiOperation({ summary: 'Current conditions for observation metadata' })
  current(@Query() q: CoordinatesQueryDto) {
    return this.weather.getCurrent(q.lat, q.lng);
  }

  @Post('window')
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Spray window verdict for the forecast horizon' })
  async window(@Body() body: WindowRequestDto) {
    const forecast = await this.weather.getForecast(body.lat, body.lng);
    return this.weather.evaluateWindow(forecast, body.constraints);
  }
}
