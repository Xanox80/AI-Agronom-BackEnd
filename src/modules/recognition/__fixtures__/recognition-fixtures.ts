import { Organ, ProblemCategory } from '../../../domain/enums';
import { VisionHypothesis, VisionOutput } from '../../vision-provider/vision.types';
import { RecognitionConfig } from '../recognition.config';

export const testConfig = (overrides: Partial<RecognitionConfig> = {}): RecognitionConfig => ({
  calibrationTemperature: 1,
  unsureThreshold: 0.5,
  oodEntropyThreshold: 0.85,
  closeMargin: 0.15,
  topK: 3,
  multiframeAggregation: 'mean_prob',
  criticalRecallBias: 0,
  referencesPerHypothesis: 3,
  plantsPerM2: 100,
  plantsPerM2ByCrop: { maize: 7 },
  answerEvidenceFactor: 2,
  defaultLocale: 'uk',
  providerConcurrency: 2,
  fieldHistoryLimit: 5,
  oodFrameFraction: 0.5,
  minFrameProbability: 0.000001,
  maxPhotos: 3,
  storageDir: './data/storage',
  referenceImageUrlBase: '/api/v1/catalog/reference-images',
  similarPhotoUrlBase: '/api/v1/similarity/photos',
  ...overrides,
});

export const hypothesis = (diagnosisCode: string, probability: number, overrides: Partial<VisionHypothesis> = {}): VisionHypothesis => ({
  diagnosisCode, probability, stage: null, evidence: '', region: null, ...overrides,
});

export const frameOutput = (hypotheses: VisionHypothesis[], overrides: Partial<VisionOutput> = {}): VisionOutput => ({
  crop: 'wheat_winter', organ: Organ.Leaf, problemCategory: ProblemCategory.Disease, hypotheses, pest: null,
  clarifyingQuestions: [], outOfDistribution: false, raw: {}, ...overrides,
});
