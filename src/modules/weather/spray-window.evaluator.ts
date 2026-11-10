import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { WeatherVerdict } from '../../domain/enums';
import { isRainExpected, RAIN_EXPECTED_CAUSE, SPRAY_RULES } from './spray-rules';
import { HourlyWeather, HourVerdict, SprayConstraints, WeatherWindow } from './weather.types';

@Injectable()
export class SprayWindowEvaluator {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  evaluate(hourly: HourlyWeather[], overrides: Partial<SprayConstraints> = {}): WeatherWindow {
    const limits = { ...this.config.get('weather', { infer: true }), ...this.definedOnly(overrides) };
    const hours = hourly.map((hour, i) => this.evaluateHour(hour, hourly.slice(i + 1, i + 1 + limits.rainFreeHours), limits));
    return this.summarize(hours);
  }

  private evaluateHour(hour: HourlyWeather, upcoming: HourlyWeather[], limits: SprayConstraints): HourVerdict {
    const causes = SPRAY_RULES.map((r) => r.cause(hour, limits)).filter((c): c is string => c !== null);
    if (causes.length > 0) return { time: hour.time, verdict: WeatherVerdict.NoGo, causes };
    if (isRainExpected(upcoming, limits)) return { time: hour.time, verdict: WeatherVerdict.Wait, causes: [RAIN_EXPECTED_CAUSE] };
    return { time: hour.time, verdict: WeatherVerdict.Go, causes: [] };
  }

  private summarize(hours: HourVerdict[]): WeatherWindow {
    const now = hours[0];
    if (!now) return { verdict: WeatherVerdict.NoGo, reason: 'weather.window.no_data', reasonParams: {}, hours };
    if (now.verdict === WeatherVerdict.Go) return { verdict: WeatherVerdict.Go, reason: 'weather.window.go', reasonParams: {}, hours };
    const next = hours.find((h) => h.verdict === WeatherVerdict.Go);
    if (!next) return { verdict: WeatherVerdict.NoGo, reason: 'weather.window.no_go', reasonParams: { causes: now.causes }, hours };
    return {
      verdict: WeatherVerdict.Wait, reason: 'weather.window.wait', reasonParams: { causes: now.causes, nextGoAt: next.time },
      nextGoAt: next.time, hours,
    };
  }

  private definedOnly(o: Partial<SprayConstraints>): Partial<SprayConstraints> {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  }
}
