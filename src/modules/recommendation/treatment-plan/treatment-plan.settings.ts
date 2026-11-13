import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/app-config';
import { Env, EnvReader } from '../../../config/env-reader';

export const TREATMENT_PLAN_SETTINGS = Symbol('TREATMENT_PLAN_SETTINGS');

export interface TreatmentPlanSettings {
  /** Without a Groq key the endpoint answers 503 and the rules-engine recommendation is all there is. */
  groqApiKey: string;
  /** Text model on Groq; it gets no photos, only the registry facts. */
  model: string;
  temperature: number;
  timeoutMs: number;
  /** Spray volumes the model may choose from; outside this the plan is rejected. */
  waterLPerHa: { min: number; max: number };
  /** Used when the request does not name the sprayer tank. */
  defaultTankVolumeL: number;
}

export const TREATMENT_PLAN_ENV_KEYS = [
  'TREATMENT_PLAN_MODEL', 'TREATMENT_PLAN_TEMPERATURE', 'TREATMENT_PLAN_TIMEOUT_MS', 'TREATMENT_PLAN_WATER_MIN_L_PER_HA',
  'TREATMENT_PLAN_WATER_MAX_L_PER_HA', 'TREATMENT_PLAN_DEFAULT_TANK_L',
] as const;

export function buildTreatmentPlanSettings(groqApiKey: string, env: Env): TreatmentPlanSettings {
  const r = new EnvReader(env);
  const settings: TreatmentPlanSettings = {
    groqApiKey,
    model: r.string('TREATMENT_PLAN_MODEL', 'openai/gpt-oss-120b'),
    temperature: r.number('TREATMENT_PLAN_TEMPERATURE', 0.2),
    timeoutMs: r.number('TREATMENT_PLAN_TIMEOUT_MS', 45000),
    waterLPerHa: { min: r.number('TREATMENT_PLAN_WATER_MIN_L_PER_HA', 100), max: r.number('TREATMENT_PLAN_WATER_MAX_L_PER_HA', 400) },
    defaultTankVolumeL: r.number('TREATMENT_PLAN_DEFAULT_TANK_L', 3000),
  };
  if (settings.waterLPerHa.min <= 0 || settings.waterLPerHa.min > settings.waterLPerHa.max) {
    throw new Error('TREATMENT_PLAN_WATER_MIN_L_PER_HA must be positive and not above TREATMENT_PLAN_WATER_MAX_L_PER_HA');
  }
  return settings;
}

export function readTreatmentPlanSettings(config: ConfigService<AppConfig, true>): TreatmentPlanSettings {
  return buildTreatmentPlanSettings(
    config.get('ai', { infer: true }).groqApiKey,
    Object.fromEntries(TREATMENT_PLAN_ENV_KEYS.map((key) => [key, config.get<string>(key as never)])),
  );
}
