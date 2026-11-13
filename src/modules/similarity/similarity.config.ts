import { Env, EnvReader } from '../../config/env-reader';

export const SIMILARITY_CONFIG = Symbol('SIMILARITY_CONFIG');

export const EMBEDDER_DTYPES = ['fp32', 'fp16', 'q8'] as const;
export type EmbedderDtype = (typeof EMBEDDER_DTYPES)[number];
export type EmbedderDevice = 'cpu' | 'dml';

export interface SimilarityConfig {
  /** Off: recognition ignores the reference base entirely and works as before. */
  enabled: boolean;
  qdrantUrl: string;
  qdrantApiKey: string;
  collection: string;
  embedderModel: string;
  /** ONNX weights variant of the embedder: fp32 is the most accurate, q8 is ~4x smaller and faster. */
  embedderDtype: EmbedderDtype;
  /** cpu, or dml = DirectML GPU (Windows; ~10x faster on a discrete card). */
  embedderDevice: EmbedderDevice;
  /** DirectML adapter index; on laptops 0 is often the integrated GPU and 1 the discrete one. */
  embedderGpuId: number;
  modelCacheDir: string;
  /** Labelled neighbours fetched per photo. */
  neighbours: number;
  /** Share of the neighbour vote in the blended hypothesis scores (0 = ignore, 1 = neighbours only). */
  blendWeight: number;
  /** A neighbour's vote is similarity^exponent, so close matches outweigh many loose ones. */
  voteExponent: number;
  /** Best cosine similarity below this marks the photo as unlike anything labelled; 0 turns the check off. */
  oodMinScore: number;
  /** Lookup budget per diagnosis; on timeout recognition continues without neighbours. */
  timeoutMs: number;
  indexBatchSize: number;
  /** Trained probe written by `npm run train:classifier`; missing file = kNN vote. */
  classifierPath: string;
  trainEpochs: number;
  trainLearningRate: number;
  trainL2: number;
  /** Share of reference vectors held out to report the probe's accuracy. */
  trainValidationFraction: number;
  /** Cap on one photo's training weight, so a single confirmed photo cannot outweigh a whole dataset. */
  trainMaxSampleWeight: number;
  /** Wait after a confirmation before retraining, so a burst of confirmations costs one retrain. */
  retrainDelayMs: number;
  /** Folder that holds the indexed datasets; reference photos are served from below it only. */
  datasetsDir: string;
  /** Most similar labelled photos shown per hypothesis for comparison. */
  examplesPerDiagnosis: number;
  /** Where `npm run lab` keeps its embedding cache, run history and HTML reports. */
  labDir: string;
}

export const SIMILARITY_ENV_KEYS = [
  'SIMILARITY_ENABLED', 'QDRANT_URL', 'QDRANT_API_KEY', 'QDRANT_COLLECTION', 'SIMILARITY_EMBEDDER_MODEL',
  'SIMILARITY_EMBEDDER_DTYPE', 'SIMILARITY_MODEL_CACHE_DIR', 'SIMILARITY_NEIGHBOURS', 'SIMILARITY_BLEND_WEIGHT',
  'SIMILARITY_VOTE_EXPONENT', 'SIMILARITY_OOD_MIN_SCORE', 'SIMILARITY_TIMEOUT_MS', 'SIMILARITY_INDEX_BATCH_SIZE',
  'SIMILARITY_CLASSIFIER_PATH', 'SIMILARITY_TRAIN_EPOCHS', 'SIMILARITY_TRAIN_LEARNING_RATE', 'SIMILARITY_TRAIN_L2',
  'SIMILARITY_TRAIN_VALIDATION_FRACTION', 'SIMILARITY_TRAIN_MAX_SAMPLE_WEIGHT', 'SIMILARITY_RETRAIN_DELAY_MS',
  'SIMILARITY_DATASETS_DIR', 'SIMILARITY_EXAMPLES_PER_DIAGNOSIS', 'SIMILARITY_EMBEDDER_DEVICE', 'SIMILARITY_EMBEDDER_GPU_ID',
  'SIMILARITY_LAB_DIR',
] as const;

export function buildSimilarityConfig(env: Env): SimilarityConfig {
  const r = new EnvReader(env);
  const config: SimilarityConfig = {
    enabled: r.boolean('SIMILARITY_ENABLED', false),
    qdrantUrl: r.string('QDRANT_URL', ''),
    qdrantApiKey: r.string('QDRANT_API_KEY', ''),
    collection: r.string('QDRANT_COLLECTION', 'crop_references'),
    embedderModel: r.string('SIMILARITY_EMBEDDER_MODEL', 'Xenova/clip-vit-base-patch32'),
    embedderDtype: r.oneOf('SIMILARITY_EMBEDDER_DTYPE', EMBEDDER_DTYPES, 'fp32'),
    embedderDevice: r.oneOf('SIMILARITY_EMBEDDER_DEVICE', ['cpu', 'dml'] as const, 'cpu'),
    embedderGpuId: r.number('SIMILARITY_EMBEDDER_GPU_ID', 0),
    modelCacheDir: r.string('SIMILARITY_MODEL_CACHE_DIR', './data/models'),
    neighbours: r.number('SIMILARITY_NEIGHBOURS', 20),
    blendWeight: r.number('SIMILARITY_BLEND_WEIGHT', 0.3),
    voteExponent: r.number('SIMILARITY_VOTE_EXPONENT', 4),
    oodMinScore: r.number('SIMILARITY_OOD_MIN_SCORE', 0),
    timeoutMs: r.number('SIMILARITY_TIMEOUT_MS', 15000),
    indexBatchSize: r.number('SIMILARITY_INDEX_BATCH_SIZE', 32),
    classifierPath: r.string('SIMILARITY_CLASSIFIER_PATH', './data/models/reference-classifier.json'),
    trainEpochs: r.number('SIMILARITY_TRAIN_EPOCHS', 300),
    trainLearningRate: r.number('SIMILARITY_TRAIN_LEARNING_RATE', 0.5),
    trainL2: r.number('SIMILARITY_TRAIN_L2', 0.001),
    trainValidationFraction: r.number('SIMILARITY_TRAIN_VALIDATION_FRACTION', 0.15),
    trainMaxSampleWeight: r.number('SIMILARITY_TRAIN_MAX_SAMPLE_WEIGHT', 10),
    retrainDelayMs: r.number('SIMILARITY_RETRAIN_DELAY_MS', 60000),
    datasetsDir: r.string('SIMILARITY_DATASETS_DIR', './data/datasets'),
    examplesPerDiagnosis: r.number('SIMILARITY_EXAMPLES_PER_DIAGNOSIS', 3),
    labDir: r.string('SIMILARITY_LAB_DIR', './data/lab'),
  };
  if (config.blendWeight < 0 || config.blendWeight > 1) throw new Error('Config key SIMILARITY_BLEND_WEIGHT must be between 0 and 1');
  if (config.enabled && !config.qdrantUrl) throw new Error('Missing required config key QDRANT_URL (SIMILARITY_ENABLED=true)');
  return config;
}
