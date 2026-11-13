import { readFileSync } from 'fs';
import { TrainingOptions } from '../classifier/softmax-classifier';
import { EMBEDDER_DTYPES, EmbedderDtype } from '../similarity.config';

export interface LabDataset {
  /** Folder below SIMILARITY_DATASETS_DIR. */
  folder: string;
  /** Mapping file (dataset label -> catalogue codes), relative to the project root. */
  mapping: string;
}

/** One training recipe: which image model, which datasets, which classifier settings. */
export interface LabExperiment {
  name: string;
  embedder: { model: string; dtype: EmbedderDtype };
  datasets: LabDataset[];
  /** Share of photos kept aside to measure accuracy, for datasets without their own test/valid folders. */
  testFraction: number;
  training: TrainingOptions;
}

export function parseLabExperiment(json: string, origin: string): LabExperiment {
  const parsed = JSON.parse(json) as Partial<LabExperiment>;
  const fail = (message: string): never => { throw new Error(`${origin}: ${message}`); };
  if (!parsed.name) fail('"name" is required');
  if (!parsed.embedder?.model) fail('"embedder.model" is required');
  if (!EMBEDDER_DTYPES.includes(parsed.embedder!.dtype)) fail(`"embedder.dtype" must be one of ${EMBEDDER_DTYPES.join(', ')}`);
  if (!parsed.datasets?.length) fail('"datasets" must list at least one dataset');
  parsed.datasets!.forEach((dataset, i) => { if (!dataset.folder || !dataset.mapping) fail(`datasets[${i}] needs "folder" and "mapping"`); });
  const testFraction = parsed.testFraction ?? 0.2;
  if (testFraction <= 0 || testFraction >= 1) fail('"testFraction" must be between 0 and 1');
  const training = parsed.training;
  if (!training?.epochs || !training.learningRate || training.l2 === undefined) fail('"training" needs epochs, learningRate and l2');
  return { name: parsed.name!, embedder: parsed.embedder!, datasets: parsed.datasets!, testFraction, training: training! };
}

export function readLabExperiment(path: string): LabExperiment {
  return parseLabExperiment(readFileSync(path, 'utf8'), path);
}
