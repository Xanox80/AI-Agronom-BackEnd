import { AppConfig } from '../../config/app-config';
import { Env, EnvReader } from '../../config/env-reader';
import { Locale, SUPPORTED_LOCALES } from './recognition.constants';

export type RecognitionConfig = AppConfig['recognition'] & {
  referencesPerHypothesis: number;
  plantsPerM2: number;
  plantsPerM2ByCrop: Record<string, number>;
  answerEvidenceFactor: number;
  defaultLocale: Locale;
  maxPhotos: number;
  storageDir: string;
  referenceImageUrlBase: string;
  similarPhotoUrlBase: string;
  providerConcurrency: number;
  fieldHistoryLimit: number;
  oodFrameFraction: number;
  minFrameProbability: number;
};

const DEFAULT_PLANTS_PER_M2_BY_CROP = 'wheat_winter:400,rapeseed:50,soybean:45,maize:7,sunflower:6';

/** "crop:value,crop:value" to a map; a malformed entry fails startup rather than skewing densities. */
function parseCropNumbers(raw: string): Record<string, number> {
  return Object.fromEntries(raw.split(',').filter(Boolean).map((entry) => {
    const [crop, value] = entry.split(':').map((part) => part.trim());
    const parsed = Number(value);
    if (!crop || !value || Number.isNaN(parsed)) throw new Error(`Config key RECOGNITION_PLANTS_PER_M2_BY_CROP has a bad entry: ${entry}`);
    return [crop, parsed];
  }));
}

export const RECOGNITION_CONFIG = Symbol('RECOGNITION_CONFIG');

export const RECOGNITION_ENV_KEYS = [
  'RECOGNITION_REFERENCES_PER_HYPOTHESIS', 'RECOGNITION_PLANTS_PER_M2', 'RECOGNITION_PLANTS_PER_M2_BY_CROP', 'RECOGNITION_ANSWER_EVIDENCE_FACTOR',
  'RECOGNITION_DEFAULT_LOCALE', 'RECOGNITION_PROVIDER_CONCURRENCY', 'RECOGNITION_FIELD_HISTORY_LIMIT',
  'RECOGNITION_OOD_FRAME_FRACTION', 'RECOGNITION_MIN_FRAME_PROBABILITY',
] as const;

export function buildRecognitionConfig(app: AppConfig, env: Env): RecognitionConfig {
  const r = new EnvReader(env);
  return {
    ...app.recognition,
    referencesPerHypothesis: r.number('RECOGNITION_REFERENCES_PER_HYPOTHESIS', 3),
    plantsPerM2: r.number('RECOGNITION_PLANTS_PER_M2', 250),
    plantsPerM2ByCrop: parseCropNumbers(r.string('RECOGNITION_PLANTS_PER_M2_BY_CROP', DEFAULT_PLANTS_PER_M2_BY_CROP)),
    answerEvidenceFactor: r.number('RECOGNITION_ANSWER_EVIDENCE_FACTOR', 2),
    defaultLocale: r.oneOf('RECOGNITION_DEFAULT_LOCALE', SUPPORTED_LOCALES, 'uk'),
    providerConcurrency: r.number('RECOGNITION_PROVIDER_CONCURRENCY', 2),
    fieldHistoryLimit: r.number('RECOGNITION_FIELD_HISTORY_LIMIT', 5),
    oodFrameFraction: r.number('RECOGNITION_OOD_FRAME_FRACTION', 0.5),
    minFrameProbability: r.number('RECOGNITION_MIN_FRAME_PROBABILITY', 0.000001),
    maxPhotos: app.storage.maxPhotosPerObservation,
    storageDir: app.storage.dir,
    referenceImageUrlBase: `/${app.app.apiPrefix}/catalog/reference-images`,
    similarPhotoUrlBase: `/${app.app.apiPrefix}/similarity/photos`,
  };
}
