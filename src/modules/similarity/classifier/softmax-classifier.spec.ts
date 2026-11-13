import { accuracy, holdOut, LabelledVector, predictSoftmax, trainSoftmax, trainSoftmaxInBackground } from './softmax-classifier';

const options = { epochs: 200, learningRate: 0.5, l2: 0.001 };
const cluster = (label: string, centre: number[], count: number): LabelledVector[] =>
  Array.from({ length: count }, (_, i) => ({ label, vector: centre.map((c, j) => c + 0.05 * Math.sin(i * 7 + j * 3)) }));

describe('softmax classifier', () => {
  const samples = [...cluster('rust', [1, 0, 0], 30), ...cluster('septoria', [0, 1, 0], 30), ...cluster('healthy', [0, 0, 1], 10)];

  it('learns separable classes, including the smaller one', () => {
    const model = trainSoftmax(samples, options);

    expect(accuracy(model, samples)).toBe(1);
    expect(Object.entries(predictSoftmax(model, [0.05, 0.05, 0.95])).sort((a, b) => b[1] - a[1])[0][0]).toBe('healthy');
  });

  it('returns a probability for every class that sums to one', () => {
    const probabilities = predictSoftmax(trainSoftmax(samples, options), [0.5, 0.5, 0]);

    expect(Object.keys(probabilities).sort()).toEqual(['healthy', 'rust', 'septoria']);
    expect(Object.values(probabilities).reduce((sum, p) => sum + p, 0)).toBeCloseTo(1);
  });

  it('lets per-sample weight decide between conflicting labels', () => {
    const conflicting = [{ label: 'rust', vector: [1, 0], weight: 3 }, { label: 'rust', vector: [0, 1], weight: 1 },
      { label: 'septoria', vector: [1, 0], weight: 1 }, { label: 'septoria', vector: [0, 1], weight: 3 }];
    const model = trainSoftmax(conflicting, options);

    expect(predictSoftmax(model, [1, 0]).rust).toBeGreaterThan(0.5);
    expect(predictSoftmax(model, [0, 1]).septoria).toBeGreaterThan(0.5);
  });

  it('trains the same model in the background as in the foreground', async () => {
    expect(await trainSoftmaxInBackground(samples, options)).toEqual(trainSoftmax(samples, options));
  });

  it('reports a falling loss after every epoch', async () => {
    const losses: number[] = [];
    await trainSoftmaxInBackground(samples, options, ({ epoch, loss }) => { losses[epoch - 1] = loss; });
    expect(losses).toHaveLength(options.epochs);
    expect(losses[losses.length - 1]).toBeLessThan(losses[0]);
  });

  it('is deterministic', () => {
    expect(trainSoftmax(samples, options)).toEqual(trainSoftmax(samples, options));
  });

  it('holds out a share of every class for validation', () => {
    const { train, validation } = holdOut(samples, 0.2);

    expect(validation.filter((s) => s.label === 'healthy')).toHaveLength(2);
    expect(validation.filter((s) => s.label === 'rust')).toHaveLength(6);
    expect(train.length + validation.length).toBe(samples.length);
  });

  it('refuses to train on nothing', () => {
    expect(() => trainSoftmax([], options)).toThrow('No samples');
  });
});
