import { parseLabExperiment } from './lab-experiment';

describe('parseLabExperiment', () => {
  const valid = {
    name: 'dinov2', embedder: { model: 'onnx-community/dinov2-base', dtype: 'fp16' },
    datasets: [{ folder: 'wheat-leaf', mapping: 'docs/datasets/wheat-leaf.mapping.json' }],
    training: { epochs: 300, learningRate: 0.5, l2: 0.001 },
  };

  it('reads a recipe and defaults the test share to 20%', () => {
    expect(parseLabExperiment(JSON.stringify(valid), 'x.json')).toEqual({ ...valid, testFraction: 0.2 });
  });

  it('names the file and the missing part when a recipe is incomplete', () => {
    expect(() => parseLabExperiment(JSON.stringify({ ...valid, datasets: [] }), 'x.json')).toThrow('x.json: "datasets"');
    expect(() => parseLabExperiment(JSON.stringify({ ...valid, embedder: { model: 'm', dtype: 'int4' } }), 'x.json')).toThrow('embedder.dtype');
    expect(() => parseLabExperiment(JSON.stringify({ ...valid, testFraction: 1 }), 'x.json')).toThrow('testFraction');
    expect(() => parseLabExperiment(JSON.stringify({ ...valid, training: { epochs: 10 } }), 'x.json')).toThrow('training');
  });
});
