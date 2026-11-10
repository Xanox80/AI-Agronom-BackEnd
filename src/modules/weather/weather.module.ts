import { Module } from '@nestjs/common';
import { OpenMeteoClient } from './open-meteo.client';
import { SprayWindowEvaluator } from './spray-window.evaluator';
import { WeatherClock } from './weather-clock';
import { WeatherCache } from './weather-cache';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  controllers: [WeatherController],
  providers: [WeatherService, OpenMeteoClient, WeatherCache, WeatherClock, SprayWindowEvaluator],
  exports: [WeatherService],
})
export class WeatherModule {}
