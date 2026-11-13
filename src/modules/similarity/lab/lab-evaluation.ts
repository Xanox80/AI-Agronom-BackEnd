import { predictSoftmax, SoftmaxModel } from '../classifier/softmax-classifier';

export interface TestPhoto {
  vector: number[];
  /** True diagnosis code. */
  label: string;
  source: string;
  /** Absolute file path, for showing the photo in the report. */
  file: string;
}

export interface ClassScore {
  code: string;
  /** Test photos of this class. */
  support: number;
  /** Of the photos called this class, the share that really were. */
  precision: number;
  /** Of the photos of this class, the share found. */
  recall: number;
  f1: number;
}

export interface Mistake {
  file: string;
  source: string;
  actual: string;
  predicted: string;
  confidence: number;
}

export interface Evaluation {
  total: number;
  accuracy: number;
  /** The true class is among the three most probable: what the scout sees as the top-3. */
  top3Accuracy: number;
  /** Mean F1 over classes, so a rare disease counts as much as a common one. */
  macroF1: number;
  classes: string[];
  /** confusion[actual][predicted], indexes into `classes`. */
  confusion: number[][];
  perClass: ClassScore[];
  perSource: Array<{ source: string; total: number; accuracy: number }>;
  /** Wrong answers given with the most confidence first: the ones that would mislead a scout. */
  mistakes: Mistake[];
}

function ranked(model: SoftmaxModel, vector: number[]): Array<[string, number]> {
  return Object.entries(predictSoftmax(model, vector)).sort((a, b) => b[1] - a[1]);
}

function share(part: number, whole: number): number {
  return whole ? part / whole : 0;
}

function classScores(classes: string[], confusion: number[][]): ClassScore[] {
  return classes.map((code, c) => {
    const support = confusion[c].reduce((sum, n) => sum + n, 0);
    const called = confusion.reduce((sum, row) => sum + row[c], 0);
    const precision = share(confusion[c][c], called);
    const recall = share(confusion[c][c], support);
    return { code, support, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
  });
}

export function evaluate(model: SoftmaxModel, photos: TestPhoto[], maxMistakes: number): Evaluation {
  const classes = [...new Set([...model.classes, ...photos.map((photo) => photo.label)])].sort();
  const confusion = classes.map(() => new Array<number>(classes.length).fill(0));
  const bySource = new Map<string, { total: number; correct: number }>();
  const mistakes: Mistake[] = [];
  let correct = 0;
  let inTop3 = 0;
  photos.forEach((photo) => {
    const top = ranked(model, photo.vector);
    const [predicted, confidence] = top[0];
    confusion[classes.indexOf(photo.label)][classes.indexOf(predicted)] += 1;
    const source = bySource.get(photo.source) ?? { total: 0, correct: 0 };
    bySource.set(photo.source, source);
    source.total += 1;
    if (predicted === photo.label) {
      correct += 1;
      source.correct += 1;
    } else {
      mistakes.push({ file: photo.file, source: photo.source, actual: photo.label, predicted, confidence });
    }
    if (top.slice(0, 3).some(([code]) => code === photo.label)) inTop3 += 1;
  });
  const perClass = classScores(classes, confusion).filter((score) => score.support > 0);
  return {
    total: photos.length,
    accuracy: share(correct, photos.length),
    top3Accuracy: share(inTop3, photos.length),
    macroF1: share(perClass.reduce((sum, score) => sum + score.f1, 0), perClass.length),
    classes, confusion, perClass,
    perSource: [...bySource].map(([name, s]) => ({ source: name, total: s.total, accuracy: share(s.correct, s.total) })),
    mistakes: mistakes.sort((a, b) => b.confidence - a.confidence).slice(0, maxMistakes),
  };
}

/** Plain accuracy, cheap enough to track every few epochs. */
export function quickAccuracy(model: SoftmaxModel, photos: TestPhoto[]): number {
  return share(photos.filter((photo) => ranked(model, photo.vector)[0][0] === photo.label).length, photos.length);
}
