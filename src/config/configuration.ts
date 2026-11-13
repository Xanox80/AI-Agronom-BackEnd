import { AppConfig } from './app-config';
import { Env, EnvReader } from './env-reader';

const DEV_JWT_SECRET = 'dev-only-change-me';

/** Builds the typed config from the environment; throws at boot on invalid values. */
export function buildConfig(env: Env): AppConfig {
  const r = new EnvReader(env);
  const nodeEnv = r.string('NODE_ENV', 'development');
  const production = nodeEnv === 'production';
  const provider = r.oneOf('AI_PROVIDER', ['gemini', 'groq', 'mock', 'local'] as const, 'gemini');
  const geminiApiKey = r.string('GEMINI_API_KEY', '');
  const groqApiKey = r.string('GROQ_API_KEY', '');
  if (production && provider === 'gemini' && !geminiApiKey) throw new Error('Missing required config key GEMINI_API_KEY');
  if (production && provider === 'groq' && !groqApiKey) throw new Error('Missing required config key GROQ_API_KEY');

  return {
    app: {
      port: r.number('PORT', 3000), env: nodeEnv, apiPrefix: r.string('API_PREFIX', 'api/v1'),
      corsOrigins: r.list('CORS_ORIGINS', ['http://localhost:4200']),
    },
    database: { path: r.string('DB_PATH', './data/ap-scout.sqlite'), synchronize: r.boolean('DB_SYNCHRONIZE', true) },
    auth: {
      jwtSecret: production ? r.required('JWT_SECRET') : r.string('JWT_SECRET', DEV_JWT_SECRET),
      jwtExpiresIn: r.string('JWT_EXPIRES_IN', '15m'),
      refreshTokenExpiresDays: r.number('REFRESH_TOKEN_EXPIRES_DAYS', 30),
      bcryptRounds: r.number('BCRYPT_ROUNDS', 10),
      loginMaxAttempts: r.number('LOGIN_MAX_ATTEMPTS', 5),
      loginWindowSeconds: r.number('LOGIN_WINDOW_SECONDS', 300),
      trustWeights: {
        expert: r.number('TRUST_WEIGHT_EXPERT', 3.0), chief: r.number('TRUST_WEIGHT_CHIEF', 2.0),
        scout: r.number('TRUST_WEIGHT_SCOUT', 1.0), mechanic: r.number('TRUST_WEIGHT_MECHANIC', 0.5),
      },
      expertConsensusMinWeight: r.number('EXPERT_CONSENSUS_MIN_WEIGHT', 3.0),
    },
    storage: {
      dir: r.string('STORAGE_DIR', './data/storage'), maxPhotoMb: r.number('UPLOAD_MAX_PHOTO_MB', 10),
      maxVoiceMb: r.number('UPLOAD_MAX_VOICE_MB', 5),
      allowedImageTypes: r.list('UPLOAD_ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']),
      maxPhotosPerObservation: r.number('MAX_PHOTOS_PER_OBSERVATION', 3),
    },
    ai: {
      provider, geminiApiKey, geminiModel: r.string('GEMINI_MODEL', 'gemini-3.5-flash'),
      groqApiKey, groqModel: r.string('GROQ_MODEL', 'qwen/qwen3.8-27b'),
      timeoutMs: r.number('AI_TIMEOUT_MS', r.number('GEMINI_TIMEOUT_MS', 30000)),
      maxRetries: r.number('AI_MAX_RETRIES', r.number('GEMINI_MAX_RETRIES', 2)),
      retryBaseDelayMs: r.number('AI_RETRY_BASE_DELAY_MS', r.number('GEMINI_RETRY_BASE_DELAY_MS', 1500)),
      retryMaxDelayMs: r.number('AI_RETRY_MAX_DELAY_MS', r.number('GEMINI_RETRY_MAX_DELAY_MS', 30000)),
      temperature: r.number('AI_TEMPERATURE', 0.2),
    },
    recognition: {
      calibrationTemperature: r.number('RECOGNITION_CALIBRATION_TEMPERATURE', 1.5),
      unsureThreshold: r.number('RECOGNITION_UNSURE_THRESHOLD', 0.5),
      oodEntropyThreshold: r.number('RECOGNITION_OOD_ENTROPY_THRESHOLD', 0.85),
      closeMargin: r.number('RECOGNITION_CLOSE_MARGIN', 0.15), topK: r.number('RECOGNITION_TOP_K', 3),
      multiframeAggregation: r.oneOf('RECOGNITION_MULTIFRAME_AGGREGATION', ['mean_log_prob', 'mean_prob'] as const, 'mean_log_prob'),
      criticalRecallBias: r.number('RECOGNITION_CRITICAL_RECALL_BIAS', 0.1),
    },
    weather: {
      providerUrl: r.string('WEATHER_PROVIDER_URL', 'https://api.open-meteo.com/v1/forecast'),
      horizonHours: r.number('WEATHER_HORIZON_HOURS', 72), cacheTtlMinutes: r.number('WEATHER_CACHE_TTL_MINUTES', 60),
      cacheCoordPrecision: r.number('WEATHER_CACHE_COORD_PRECISION', 2), timeoutMs: r.number('WEATHER_TIMEOUT_MS', 8000),
      maxWindMs: r.number('WEATHER_MAX_WIND_MS', 5), minTempC: r.number('WEATHER_MIN_TEMP_C', 5),
      maxTempC: r.number('WEATHER_MAX_TEMP_C', 25), maxRainMm: r.number('WEATHER_MAX_RAIN_MM', 0.5),
      rainFreeHours: r.number('WEATHER_RAIN_FREE_HOURS', 4), maxPrecipProbPct: r.number('WEATHER_MAX_PRECIP_PROB_PCT', 40),
      maxGustMs: r.number('WEATHER_MAX_GUST_MS', 8), minHumidityPct: r.number('WEATHER_MIN_HUMIDITY_PCT', 40),
      maxHumidityPct: r.number('WEATHER_MAX_HUMIDITY_PCT', 95),
    },
    safety: {
      waterBufferM: r.number('SAFETY_WATER_BUFFER_M', 50), apiaryBufferM: r.number('SAFETY_APIARY_BUFFER_M', 4000),
      settlementBufferM: r.number('SAFETY_SETTLEMENT_BUFFER_M', 300),
    },
    recommendation: {
      maxItems: r.number('RECOMMENDATION_MAX_ITEMS', 3),
      maxSameGroupPerSeason: r.number('RECOMMENDATION_MAX_SAME_GROUP_PER_SEASON', 2),
      seasonStartMonth: r.number('RECOMMENDATION_SEASON_START_MONTH', 3),
      rankWeights: {
        efficacy: r.number('RECOMMENDATION_RANK_WEIGHT_EFFICACY', 0.5), stock: r.number('RECOMMENDATION_RANK_WEIGHT_STOCK', 0.3),
        cost: r.number('RECOMMENDATION_RANK_WEIGHT_COST', 0.2),
      },
      autoApproveMinConfidence: r.number('RECOMMENDATION_AUTO_APPROVE_MIN_CONFIDENCE', 0.9),
    },
    catalog: {
      staleDays: r.number('CATALOG_STALE_DAYS', 180), seedDemo: r.boolean('CATALOG_SEED_DEMO', true),
      defaultRegion: r.string('CATALOG_DEFAULT_REGION', 'UA-DEFAULT'),
    },
    sync: {
      backoffBaseMs: r.number('SYNC_BACKOFF_BASE_MS', 2000), backoffMaxMs: r.number('SYNC_BACKOFF_MAX_MS', 300000),
      backoffFactor: r.number('SYNC_BACKOFF_FACTOR', 2), batchSize: r.number('SYNC_BATCH_SIZE', 25),
      refineConcurrency: r.number('SYNC_REFINE_CONCURRENCY', 2), refineMaxAttempts: r.number('SYNC_REFINE_MAX_ATTEMPTS', 5),
      refineRetryBaseMs: r.number('SYNC_REFINE_RETRY_BASE_MS', 60000), refineRetryMaxMs: r.number('SYNC_REFINE_RETRY_MAX_MS', 900000),
      refineQuotaPauseMs: r.number('SYNC_REFINE_QUOTA_PAUSE_MS', 3600000),
      clientConfigExposed: r.boolean('SYNC_CLIENT_CONFIG_EXPOSED', true),
    },
    stock: { lowThresholdFraction: r.number('STOCK_LOW_THRESHOLD_FRACTION', 0.1) },
    audit: { retentionDays: r.number('AUDIT_RETENTION_DAYS', 730) },
    export: { pageSize: r.number('EXPORT_PAGE_SIZE', 500) },
  };
}

export default () => buildConfig(process.env);
