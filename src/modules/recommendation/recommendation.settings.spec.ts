import { ConfigService } from '@nestjs/config';
import { readRecommendationSettings } from './recommendation.settings';

const sections: Record<string, unknown> = {
  recommendation: { maxItems: 3, maxSameGroupPerSeason: 2, seasonStartMonth: 3, rankWeights: { efficacy: 0.5, stock: 0.3, cost: 0.2 }, autoApproveMinConfidence: 0.9 },
  safety: { waterBufferM: 50, apiaryBufferM: 4000, settlementBufferM: 300 },
  weather: { horizonHours: 72 },
  catalog: { staleDays: 180, defaultRegion: 'UA-DEFAULT' },
};
const config = { get: (key: string) => sections[key] } as unknown as ConfigService<never, true>;

describe('readRecommendationSettings', () => {
  it('maps the shared configuration sections', () => {
    const result = readRecommendationSettings(config as never, {});
    expect(result).toMatchObject({ maxItems: 3, safetyBuffers: { waterM: 50, apiaryM: 4000, settlementM: 300 }, weatherHorizonHours: 72, catalogStaleDays: 180 });
  });

  it('applies defaults for the engine tunables and crop cycles', () => {
    const result = readRecommendationSettings(config as never, {});
    expect(result.minActionProbability).toBe(0.5);
    expect(result.approachingThresholdFraction).toBe(0.7);
    expect(result.cropCycleDays.wheat_winter).toBe(300);
  });

  it('reads overrides from the environment', () => {
    const result = readRecommendationSettings(config as never, {
      RECOMMENDATION_MIN_ACTION_PROBABILITY: '0.6', RECOMMENDATION_CROP_CYCLE_DAYS: 'maize:140,soybean:120',
    });
    expect(result.minActionProbability).toBe(0.6);
    expect(result.cropCycleDays).toEqual({ maize: 140, soybean: 120 });
  });
});
