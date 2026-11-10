import { Inject, Injectable } from '@nestjs/common';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from '../recommendation.settings';
import { SprayConstraints } from '../../weather/weather.types';
import { WeatherService } from '../../weather/weather.service';
import { Candidate, PipelineContext, PipelineStep, eligible, warn } from './pipeline-types';
import { SafetyRule, PollinatorRule, apiaryBufferRule, settlementBufferRule, waterBufferRule } from './safety/safety-rules';

/** Step 4: safety restrictions (FR-18) and the 72 h weather window (FR-16) for the products that survived filtering. */
@Injectable()
export class SafetyWeatherStep implements PipelineStep {
  private readonly safetyRules: SafetyRule[] = [waterBufferRule(), apiaryBufferRule(), settlementBufferRule(), new PollinatorRule()];

  constructor(
    @Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings,
    private readonly weather: WeatherService,
  ) {}

  async run(context: PipelineContext): Promise<void> {
    const candidates = eligible(context);
    for (const candidate of candidates) {
      for (const rule of this.safetyRules) context.warnings.push(...rule.evaluate(candidate, context.input));
    }
    await this.applyWeatherWindow(context, candidates);
  }

  private async applyWeatherWindow(context: PipelineContext, candidates: Candidate[]): Promise<void> {
    const { location } = context.input;
    if (!location) return warn(context, 'weather_location_missing', 'info');
    try {
      const forecast = await this.weather.getForecast(location.lat, location.lng, this.settings.weatherHorizonHours);
      context.weather = await this.weather.evaluateWindow(forecast, this.strictestLabelLimits(candidates));
    } catch {
      warn(context, 'weather_unavailable', 'warning');
    }
  }

  private strictestLabelLimits(candidates: Candidate[]): Partial<SprayConstraints> {
    const values = (pick: (c: Candidate) => number | null) =>
      candidates.map(pick).filter((v): v is number => v !== null);
    const winds = values((c) => c.registration.maxWindSpeedMs);
    const minTemps = values((c) => c.registration.minTempC);
    const maxTemps = values((c) => c.registration.maxTempC);
    return {
      ...(winds.length && { maxWindMs: Math.min(...winds) }),
      ...(minTemps.length && { minTempC: Math.max(...minTemps) }),
      ...(maxTemps.length && { maxTempC: Math.min(...maxTemps) }),
    };
  }
}
