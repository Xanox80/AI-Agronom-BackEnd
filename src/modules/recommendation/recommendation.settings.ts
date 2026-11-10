import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { EnvReader } from '../../config/env-reader';

export const RECOMMENDATION_SETTINGS = Symbol('RECOMMENDATION_SETTINGS');

export interface RecommendationSettings {
  maxItems: number;
  maxSameGroupPerSeason: number;
  seasonStartMonth: number;
  rankWeights: { efficacy: number; stock: number; cost: number };
  autoApproveMinConfidence: number;
  safetyBuffers: { waterM: number; apiaryM: number; settlementM: number };
  weatherHorizonHours: number;
  catalogStaleDays: number;
  defaultRegion: string;
  minActionProbability: number;
  approachingThresholdFraction: number;
  defaultCropCycleDays: number;
  cropCycleDays: Record<string, number>;
}

const CROP_CYCLE_ENTRY_SEPARATOR = ':';

function parseCropCycles(entries: string[]): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => {
    const [code, days] = entry.split(CROP_CYCLE_ENTRY_SEPARATOR);
    return [code, Number(days)];
  }));
}

export function readRecommendationSettings(config: ConfigService<AppConfig, true>, env: NodeJS.ProcessEnv = process.env): RecommendationSettings {
  const reader = new EnvReader(env);
  const { recommendation, safety, weather, catalog } = {
    recommendation: config.get('recommendation', { infer: true }),
    safety: config.get('safety', { infer: true }),
    weather: config.get('weather', { infer: true }),
    catalog: config.get('catalog', { infer: true }),
  };
  return {
    maxItems: recommendation.maxItems,
    maxSameGroupPerSeason: recommendation.maxSameGroupPerSeason,
    seasonStartMonth: recommendation.seasonStartMonth,
    rankWeights: recommendation.rankWeights,
    autoApproveMinConfidence: recommendation.autoApproveMinConfidence,
    safetyBuffers: { waterM: safety.waterBufferM, apiaryM: safety.apiaryBufferM, settlementM: safety.settlementBufferM },
    weatherHorizonHours: weather.horizonHours,
    catalogStaleDays: catalog.staleDays,
    defaultRegion: catalog.defaultRegion,
    minActionProbability: reader.number('RECOMMENDATION_MIN_ACTION_PROBABILITY', 0.5),
    approachingThresholdFraction: reader.number('RECOMMENDATION_APPROACHING_THRESHOLD_FRACTION', 0.7),
    defaultCropCycleDays: reader.number('RECOMMENDATION_DEFAULT_CROP_CYCLE_DAYS', 150),
    cropCycleDays: parseCropCycles(reader.list('RECOMMENDATION_CROP_CYCLE_DAYS',
      ['wheat_winter:300', 'maize:150', 'sunflower:130', 'soybean:130', 'rapeseed:330'])),
  };
}
