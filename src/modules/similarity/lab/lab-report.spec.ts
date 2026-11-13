import { evaluate } from './lab-evaluation';
import { renderLabReport } from './lab-report';

describe('lab report', () => {
  const model = { classes: ['a', 'b'], mean: [0, 0], scale: [1, 1], weights: [[5, 0], [0, 5]], bias: [0, 0] };
  const evaluation = evaluate(model, [
    { vector: [1, 0], label: 'a', source: 'wheat', file: 'C:/data/a.jpg' },
    { vector: [1, 0], label: 'b', source: 'wheat', file: 'C:/data/<b>.jpg' },
  ], 5);

  const html = renderLabReport({
    experiment: { name: 'dinov2 <test>', embedder: { model: 'onnx-community/dinov2-base', dtype: 'fp16' }, datasets: [], testFraction: 0.2, training: { epochs: 10, learningRate: 0.5, l2: 0 } },
    evaluation, trainCounts: { a: 3, b: 4 }, loss: [{ epoch: 1, value: 1 }, { epoch: 10, value: 0.2 }],
    testAccuracy: [{ epoch: 10, value: 0.5 }], history: [], seconds: 3, nameOf: (code) => `Хвороба ${code}`,
  });

  it('shows the headline numbers and class names', () => {
    expect(html).toContain('50.0%');
    expect(html).toContain('Хвороба b');
  });

  it('escapes names taken from files and recipes', () => {
    expect(html).toContain('dinov2 &lt;test&gt;');
    expect(html).not.toContain('<test>');
  });

  it('links mistaken photos from disk', () => {
    expect(html).toContain('file:///');
  });
});
