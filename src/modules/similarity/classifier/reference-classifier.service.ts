import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity.config';
import { predictSoftmax, SoftmaxModel } from './softmax-classifier';

/** What `npm run train:classifier` writes: the probe plus the embedder it was trained on. */
export interface ClassifierFile {
  embedderModel: string;
  embedderDtype: string;
  trainedAt: string;
  sampleCounts: Record<string, number>;
  validationAccuracy: number;
  model: SoftmaxModel;
}

/**
 * Probe trained on the reference vectors. Absent file means recognition falls back to the kNN vote.
 * Read once on first use: restart the app after re-training.
 */
@Injectable()
export class ReferenceClassifier {
  private readonly logger = new Logger(ReferenceClassifier.name);
  private loaded: SoftmaxModel | null | undefined;

  constructor(@Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig) {}

  get trained(): boolean {
    return this.model() !== null;
  }

  /** Mean class probabilities over the photos, restricted to `allowedCodes` and renormalised; null without a model. */
  votes(vectors: number[][], allowedCodes: string[]): Record<string, number> | null {
    const model = this.model();
    if (!model || !vectors.length) return null;
    const allowed = new Set(allowedCodes);
    const summed: Record<string, number> = {};
    vectors.forEach((vector) => Object.entries(predictSoftmax(model, vector))
      .filter(([code]) => allowed.has(code))
      .forEach(([code, p]) => { summed[code] = (summed[code] ?? 0) + p; }));
    const total = Object.values(summed).reduce((sum, p) => sum + p, 0);
    if (total <= 0) return null;
    return Object.fromEntries(Object.entries(summed).map(([code, p]) => [code, p / total]));
  }

  private model(): SoftmaxModel | null {
    if (this.loaded === undefined) this.loaded = this.read();
    return this.loaded;
  }

  private read(): SoftmaxModel | null {
    const path = resolve(this.config.classifierPath);
    if (!this.config.classifierPath || !existsSync(path)) return null;
    const file = JSON.parse(readFileSync(path, 'utf8')) as ClassifierFile;
    if (file.embedderModel !== this.config.embedderModel || file.embedderDtype !== this.config.embedderDtype) {
      this.logger.warn(`Classifier ${path} was trained on ${file.embedderModel} (${file.embedderDtype}); re-run train:classifier. Using kNN vote`);
      return null;
    }
    this.logger.log(`Loaded reference classifier (${file.model.classes.length} classes, validation accuracy ${file.validationAccuracy.toFixed(3)})`);
    return file.model;
  }

  /** Swaps in a freshly trained model without a restart. */
  use(file: ClassifierFile): void {
    this.loaded = file.model;
    this.logger.log(`Using retrained reference classifier (${file.model.classes.length} classes, ${file.trainedAt})`);
  }
}
