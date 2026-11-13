import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Inject, Injectable } from '@nestjs/common';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity.config';
import { REFERENCE_INDEX, ReferenceIndex } from '../similarity.types';
import { ClassifierFile, ReferenceClassifier } from './reference-classifier.service';
import { accuracy, holdOut, LabelledVector, TrainingOptions, trainSoftmaxInBackground } from './softmax-classifier';
import { balanceSources } from './source-balance';

export interface TrainingReport {
  path: string;
  file: ClassifierFile;
}

function countByLabel(samples: LabelledVector[]): Record<string, number> {
  const counts: Record<string, number> = {};
  samples.forEach((sample) => { counts[sample.label] = (counts[sample.label] ?? 0) + 1; });
  return counts;
}

/**
 * Trains the reference classifier on every vector in the Qdrant collection (each dataset source weighted
 * equally within a class), saves it and makes the running app use it at once.
 */
@Injectable()
export class ClassifierTrainer {
  constructor(
    @Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig,
    @Inject(REFERENCE_INDEX) private readonly index: ReferenceIndex,
    private readonly classifier: ReferenceClassifier,
  ) {}

  /** `measureAccuracy` first trains on a split to report held-out accuracy; it doubles the training time. */
  async train(measureAccuracy: boolean): Promise<TrainingReport> {
    const samples = balanceSources(
      (await this.index.labelledVectors()).map((point) => ({ vector: point.vector, label: point.diagnosisCode, source: point.source })),
      this.config.trainMaxSampleWeight,
    );
    const sampleCounts = countByLabel(samples);
    if (Object.keys(sampleCounts).length < 2) throw new Error('Need at least two diagnosis classes in the collection to train');

    const options: TrainingOptions = { epochs: this.config.trainEpochs, learningRate: this.config.trainLearningRate, l2: this.config.trainL2 };
    let validationAccuracy = 0;
    if (measureAccuracy) {
      const { train, validation } = holdOut(samples, this.config.trainValidationFraction);
      if (validation.length) validationAccuracy = accuracy(await trainSoftmaxInBackground(train, options), validation);
    }
    const file: ClassifierFile = {
      embedderModel: this.config.embedderModel, embedderDtype: this.config.embedderDtype, trainedAt: new Date().toISOString(),
      sampleCounts, validationAccuracy, model: await trainSoftmaxInBackground(samples, options),
    };
    this.classifier.use(file);
    const path = resolve(this.config.classifierPath);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(file));
    } catch (error) {
      throw new Error(`Retrained model is in use but was not saved to ${path} (${(error as NodeJS.ErrnoException).code ?? (error as Error).message}); it is lost on restart`);
    }
    return { path, file };
  }
}
