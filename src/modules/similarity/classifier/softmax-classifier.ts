export interface LabelledVector {
  vector: number[];
  label: string;
  /** Relative importance within its class (default 1), e.g. to keep a small field dataset from being outvoted. */
  weight?: number;
}

/** Multinomial logistic regression over standardised embeddings (a "linear probe" on top of the frozen embedder). */
export interface SoftmaxModel {
  classes: string[];
  mean: number[];
  scale: number[];
  weights: number[][];
  bias: number[];
}

export interface TrainingOptions {
  epochs: number;
  learningRate: number;
  /** L2 penalty on the weights; keeps the probe from memorising single photos. */
  l2: number;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function standardise(vector: number[], mean: number[], scale: number[]): number[] {
  return vector.map((value, j) => (value - mean[j]) / scale[j]);
}

/** Per-dimension mean and spread; CLIP components are tiny, so raw values would need a huge learning rate. */
function standardisation(vectors: number[][]): { mean: number[]; scale: number[] } {
  const dim = vectors[0].length;
  const mean = Array.from({ length: dim }, (_, j) => vectors.reduce((sum, v) => sum + v[j], 0) / vectors.length);
  const scale = mean.map((m, j) => Math.sqrt(vectors.reduce((sum, v) => sum + (v[j] - m) ** 2, 0) / vectors.length) || 1);
  return { mean, scale };
}

/** Rare classes get a proportionally larger weight, so the probe does not just learn the class sizes. */
function balancedClassWeights(labels: number[], classCount: number): number[] {
  const counts = Array.from({ length: classCount }, (_, c) => labels.filter((label) => label === c).length);
  return counts.map((count) => labels.length / (classCount * count));
}

/** Full-batch gradient descent on the class-weighted cross-entropy; blocks until done (scripts, tests). */
export function trainSoftmax(samples: LabelledVector[], options: TrainingOptions): SoftmaxModel {
  const epochs = softmaxEpochs(samples, options);
  let step = epochs.next();
  while (!step.done) step = epochs.next();
  return step.value;
}

/**
 * Same result as trainSoftmax, but yields to the event loop between epochs so a running server stays responsive.
 * `onEpoch` sees the training loss after every epoch and can take a snapshot of the model so far.
 */
export async function trainSoftmaxInBackground(
  samples: LabelledVector[], options: TrainingOptions, onEpoch?: (progress: EpochProgress) => void,
): Promise<SoftmaxModel> {
  const epochs = softmaxEpochs(samples, options);
  let step = epochs.next();
  while (!step.done) {
    onEpoch?.(step.value);
    await new Promise((resolve) => setImmediate(resolve));
    step = epochs.next();
  }
  return step.value;
}

export interface EpochProgress {
  /** 1-based. */
  epoch: number;
  /** Weighted cross-entropy on the training samples before this epoch's update. */
  loss: number;
  snapshot(): SoftmaxModel;
}

/** Full-batch gradient descent, one yield per epoch; deterministic (zero init, no shuffling). */
function* softmaxEpochs(samples: LabelledVector[], options: TrainingOptions): Generator<EpochProgress, SoftmaxModel> {
  if (!samples.length) throw new Error('No samples to train on');
  const classes = [...new Set(samples.map((sample) => sample.label))].sort();
  const { mean, scale } = standardisation(samples.map((sample) => sample.vector));
  const x = samples.map((sample) => standardise(sample.vector, mean, scale));
  const y = samples.map((sample) => classes.indexOf(sample.label));
  const classWeight = balancedClassWeights(y, classes.length);
  const sampleWeight = samples.map((sample, i) => classWeight[y[i]] * (sample.weight ?? 1));
  const dim = mean.length;
  const bias = new Array<number>(classes.length).fill(0);

  const rows = x.map((row) => Float64Array.from(row));
  const w = classes.map(() => new Float64Array(dim));
  const snapshot = (): SoftmaxModel => ({ classes, mean, scale, weights: w.map((wc) => Array.from(wc)), bias: [...bias] });
  for (let epoch = 0; epoch < options.epochs; epoch++) {
    const gradW = classes.map(() => new Float64Array(dim));
    const gradB = new Float64Array(classes.length);
    let loss = 0;
    rows.forEach((row, i) => {
      const p = softmax(w.map((wc, c) => bias[c] + dot(wc, row)));
      loss -= Math.log(Math.max(p[y[i]], 1e-12)) * sampleWeight[i];
      p.forEach((pc, c) => {
        const g = (pc - (c === y[i] ? 1 : 0)) * sampleWeight[i];
        gradB[c] += g;
        const gc = gradW[c];
        for (let j = 0; j < dim; j++) gc[j] += g * row[j];
      });
    });
    w.forEach((wc, c) => {
      for (let j = 0; j < dim; j++) wc[j] -= options.learningRate * (gradW[c][j] / rows.length + options.l2 * wc[j]);
      bias[c] -= (options.learningRate * gradB[c]) / rows.length;
    });
    yield { epoch: epoch + 1, loss: loss / rows.length, snapshot };
  }
  return snapshot();
}

/** Plain loop: this is the training hot path, where reduce() costs several times more. */
function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let j = 0; j < a.length; j++) sum += a[j] * b[j];
  return sum;
}

/** Class probabilities for one embedding. */
export function predictSoftmax(model: SoftmaxModel, vector: number[]): Record<string, number> {
  const row = standardise(vector, model.mean, model.scale);
  const p = softmax(model.weights.map((w, c) => model.bias[c] + w.reduce((sum, wj, j) => sum + wj * row[j], 0)));
  return Object.fromEntries(model.classes.map((label, c) => [label, p[c]]));
}

/** Every n-th sample of each label goes to validation, so each class is represented in both halves. */
export function holdOut(samples: LabelledVector[], fraction: number): { train: LabelledVector[]; validation: LabelledVector[] } {
  if (fraction <= 0) return { train: samples, validation: [] };
  const every = Math.max(2, Math.round(1 / fraction));
  const seen = new Map<string, number>();
  const train: LabelledVector[] = [];
  const validation: LabelledVector[] = [];
  samples.forEach((sample) => {
    const index = seen.get(sample.label) ?? 0;
    seen.set(sample.label, index + 1);
    (index % every === 0 ? validation : train).push(sample);
  });
  return { train, validation };
}

/** Share of samples whose most probable class is the true label. */
export function accuracy(model: SoftmaxModel, samples: LabelledVector[]): number {
  if (!samples.length) return 0;
  const correct = samples.filter((sample) => {
    const probabilities = predictSoftmax(model, sample.vector);
    return Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0] === sample.label;
  });
  return correct.length / samples.length;
}
