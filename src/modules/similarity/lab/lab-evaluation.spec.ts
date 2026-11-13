import { SoftmaxModel } from '../classifier/softmax-classifier';
import { evaluate, quickAccuracy, TestPhoto } from './lab-evaluation';

/** Picks the class whose axis the vector points along: [1,0,0] -> a, [0,1,0] -> b, [0,0,1] -> c. */
const model: SoftmaxModel = {
  classes: ['a', 'b', 'c'], mean: [0, 0, 0], scale: [1, 1, 1],
  weights: [[5, 0, 0], [0, 5, 0], [0, 0, 5]], bias: [0, 0, 0],
};

const photo = (vector: number[], label: string, source = 's1'): TestPhoto => ({ vector, label, source, file: `${label}-${vector.join('')}.jpg` });

describe('evaluate', () => {
  const photos = [
    photo([1, 0, 0], 'a'), photo([1, 0, 0], 'a'),
    photo([0, 1, 0], 'b', 's2'), photo([1, 0, 0], 'b', 's2'),
    photo([0, 0, 1], 'c'),
  ];

  it('counts right answers, top-3 hits and a confusion row per true class', () => {
    const result = evaluate(model, photos, 10);
    expect(result.accuracy).toBeCloseTo(4 / 5);
    expect(result.top3Accuracy).toBe(1);
    expect(result.confusion).toEqual([[2, 0, 0], [1, 1, 0], [0, 0, 1]]);
  });

  it('scores each class by precision and recall', () => {
    const scores = Object.fromEntries(evaluate(model, photos, 10).perClass.map((s) => [s.code, s]));
    expect(scores.a).toMatchObject({ support: 2, precision: 2 / 3, recall: 1 });
    expect(scores.b).toMatchObject({ support: 2, precision: 1, recall: 0.5 });
  });

  it('reports accuracy per dataset source and lists confident mistakes', () => {
    const result = evaluate(model, photos, 10);
    expect(result.perSource).toEqual([{ source: 's1', total: 3, accuracy: 1 }, { source: 's2', total: 2, accuracy: 0.5 }]);
    expect(result.mistakes).toEqual([expect.objectContaining({ actual: 'b', predicted: 'a', source: 's2' })]);
  });

  it('gives the same plain accuracy cheaply', () => {
    expect(quickAccuracy(model, photos)).toBeCloseTo(4 / 5);
  });
});
