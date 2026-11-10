export interface AppConfig {
  app: { port: number; env: string; apiPrefix: string; corsOrigins: string[] };
  database: { path: string; synchronize: boolean };
  auth: {
    jwtSecret: string; jwtExpiresIn: string; refreshTokenExpiresDays: number; bcryptRounds: number;
    loginMaxAttempts: number; loginWindowSeconds: number;
    trustWeights: { expert: number; chief: number; scout: number; mechanic: number };
    expertConsensusMinWeight: number;
  };
  storage: {
    dir: string; maxPhotoMb: number; maxVoiceMb: number; allowedImageTypes: string[]; maxPhotosPerObservation: number;
  };
  ai: {
    provider: 'gemini' | 'mock'; geminiApiKey: string; geminiModel: string; geminiTimeoutMs: number;
    geminiMaxRetries: number; temperature: number;
  };
  recognition: {
    calibrationTemperature: number; unsureThreshold: number; oodEntropyThreshold: number; closeMargin: number;
    topK: number; multiframeAggregation: 'mean_log_prob' | 'mean_prob'; criticalRecallBias: number;
  };
  weather: {
    providerUrl: string; horizonHours: number; cacheTtlMinutes: number; cacheCoordPrecision: number; timeoutMs: number;
    maxWindMs: number; minTempC: number; maxTempC: number; maxRainMm: number; rainFreeHours: number; maxPrecipProbPct: number;
    maxGustMs: number; minHumidityPct: number; maxHumidityPct: number;
  };
  safety: { waterBufferM: number; apiaryBufferM: number; settlementBufferM: number };
  recommendation: {
    maxItems: number; maxSameGroupPerSeason: number; seasonStartMonth: number;
    rankWeights: { efficacy: number; stock: number; cost: number }; autoApproveMinConfidence: number;
  };
  catalog: { staleDays: number; seedDemo: boolean; defaultRegion: string };
  sync: {
    backoffBaseMs: number; backoffMaxMs: number; backoffFactor: number; batchSize: number;
    refineConcurrency: number; clientConfigExposed: boolean;
  };
  stock: { lowThresholdFraction: number };
  audit: { retentionDays: number };
  export: { pageSize: number };
}
