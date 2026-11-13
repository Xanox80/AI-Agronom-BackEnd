import { join } from 'path';
import { countByCode, splitSamples } from './lab-samples';

describe('lab-samples', () => {
  const mapping = { source: 'wheat', classes: { 'Yellow Rust': { diagnosisCode: 'wheat_yellow_rust', cropCode: 'wheat_winter' } } };

  it('labels photos with catalogue codes, splits by folder and drops unmapped classes', () => {
    const samples = splitSamples([
      { path: 'train/Yellow Rust/1.jpg', label: 'Yellow Rust', vector: [1] },
      { path: 'test/Yellow Rust/2.jpg', label: 'Yellow Rust', vector: [2] },
      { path: 'train/Stem Rust/3.jpg', label: 'Stem Rust', vector: [3] },
    ], mapping, '/data/wheat', 0.2);

    expect(samples.train).toEqual([{ vector: [1], label: 'wheat_yellow_rust', source: 'wheat' }]);
    expect(samples.test).toEqual([{ vector: [2], label: 'wheat_yellow_rust', source: 'wheat', file: join('/data/wheat', 'test/Yellow Rust/2.jpg') }]);
  });

  it('counts samples per code', () => {
    expect(countByCode([{ label: 'a' }, { label: 'b' }, { label: 'a' }])).toEqual({ a: 2, b: 1 });
  });
});
