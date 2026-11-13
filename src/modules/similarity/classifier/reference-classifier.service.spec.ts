import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildSimilarityConfig } from '../similarity.config';
import { ClassifierFile, ReferenceClassifier } from './reference-classifier.service';
import { trainSoftmax } from './softmax-classifier';

describe('ReferenceClassifier', () => {
  let dir: string;
  const model = trainSoftmax([
    { label: 'rust', vector: [1, 0] }, { label: 'rust', vector: [0.9, 0.1] },
    { label: 'septoria', vector: [0, 1] }, { label: 'septoria', vector: [0.1, 0.9] },
    { label: 'blight', vector: [-1, -1] }, { label: 'blight', vector: [-0.9, -1] },
  ], { epochs: 200, learningRate: 0.5, l2: 0.001 });

  const classifierWith = (file: Partial<ClassifierFile> | null) => {
    const path = join(dir, 'classifier.json');
    if (file) {
      writeFileSync(path, JSON.stringify({
        embedderModel: 'Xenova/clip-vit-base-patch32', embedderDtype: 'fp32', trainedAt: '', sampleCounts: {}, validationAccuracy: 1, model, ...file,
      }));
    }
    return new ReferenceClassifier(buildSimilarityConfig({ SIMILARITY_CLASSIFIER_PATH: path }));
  };

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'classifier-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('votes only over the allowed codes, renormalised', () => {
    const votes = classifierWith({}).votes([[1, 0]], ['rust', 'septoria'])!;

    expect(Object.keys(votes).sort()).toEqual(['rust', 'septoria']);
    expect(votes.rust).toBeGreaterThan(votes.septoria);
    expect(votes.rust + votes.septoria).toBeCloseTo(1);
  });

  it('averages the photos', () => {
    const votes = classifierWith({}).votes([[1, 0], [0, 1]], ['rust', 'septoria'])!;

    expect(votes.rust).toBeCloseTo(0.5, 1);
  });

  it('switches to a freshly trained model without reloading the file', () => {
    const classifier = classifierWith(null);
    classifier.use({ embedderModel: 'm', embedderDtype: 'fp32', trainedAt: '', sampleCounts: {}, validationAccuracy: 0, model });

    expect(classifier.trained).toBe(true);
    expect(classifier.votes([[1, 0]], ['rust', 'septoria'])!.rust).toBeGreaterThan(0.5);
  });

  it('returns null without a trained file, so the kNN vote is used', () => {
    expect(classifierWith(null).votes([[1, 0]], ['rust'])).toBeNull();
  });

  it('ignores a classifier trained on another embedder', () => {
    expect(classifierWith({ embedderDtype: 'q8' }).votes([[1, 0]], ['rust'])).toBeNull();
  });

  it('returns null when no allowed code is known to the model', () => {
    expect(classifierWith({}).votes([[1, 0]], ['maize_only'])).toBeNull();
  });
});
