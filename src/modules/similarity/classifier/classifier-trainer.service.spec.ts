import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildSimilarityConfig } from '../similarity.config';
import { ReferenceIndex } from '../similarity.types';
import { ClassifierTrainer } from './classifier-trainer.service';
import { ReferenceClassifier } from './reference-classifier.service';

describe('ClassifierTrainer', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'trainer-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const trainerWith = (points: { vector: number[]; diagnosisCode: string; source: string }[]) => {
    const config = buildSimilarityConfig({ SIMILARITY_CLASSIFIER_PATH: join(dir, 'c.json'), SIMILARITY_TRAIN_EPOCHS: '50' });
    const index = { labelledVectors: jest.fn().mockResolvedValue(points) } as unknown as ReferenceIndex;
    const classifier = { use: jest.fn() } as unknown as ReferenceClassifier;
    return { trainer: new ClassifierTrainer(config, index, classifier), classifier };
  };
  const points = [
    { vector: [1, 0], diagnosisCode: 'rust', source: 'kaggle' }, { vector: [0.9, 0.1], diagnosisCode: 'rust', source: 'kaggle' },
    { vector: [0, 1], diagnosisCode: 'septoria', source: 'kaggle' }, { vector: [0.1, 0.9], diagnosisCode: 'septoria', source: 'confirmed' },
  ];

  it('trains on the collection, saves the file and hands the model to the running classifier', async () => {
    const { trainer, classifier } = trainerWith(points);
    const { path, file } = await trainer.train(false);

    expect(existsSync(path)).toBe(true);
    expect(file.sampleCounts).toEqual({ rust: 2, septoria: 2 });
    expect(file.model.classes).toEqual(['rust', 'septoria']);
    expect(classifier.use).toHaveBeenCalledWith(file);
  });

  it('keeps using the retrained model when the file cannot be written', async () => {
    const { trainer, classifier } = trainerWith(points);
    const config = buildSimilarityConfig({ SIMILARITY_CLASSIFIER_PATH: join(dir, 'missing\0dir', 'c.json'), SIMILARITY_TRAIN_EPOCHS: '5' });
    const unsavable = new ClassifierTrainer(config, (trainer as unknown as { index: ReferenceIndex }).index, classifier);

    await expect(unsavable.train(false)).rejects.toThrow('in use but was not saved');
    expect(classifier.use).toHaveBeenCalled();
  });

  it('refuses to train on a single class', async () => {
    await expect(trainerWith(points.slice(0, 2)).trainer.train(false)).rejects.toThrow('two diagnosis classes');
  });
});
