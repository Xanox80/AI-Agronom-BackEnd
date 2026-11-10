import { Injectable } from '@nestjs/common';

@Injectable()
export class WeatherClock {
  now(): number {
    return Date.now();
  }
}
