import { splitOf } from './dataset-split';

describe('splitOf', () => {
  it('honours the test and valid folders a dataset ships with', () => {
    expect(splitOf('test/aphid_test/1.jpg', 0.2)).toBe('test');
    expect(splitOf('valid/aphid_valid/1.jpg', 0.2)).toBe('test');
    expect(splitOf('train/Aphid/1.jpg', 0.9)).toBe('train');
  });

  it('does not mistake a file named test for a test folder', () => {
    const sides = new Set(Array.from({ length: 50 }, (_, i) => splitOf(`Rust/test-${i}.jpg`, 0.5)));
    expect(sides).toEqual(new Set(['train', 'test']));
  });

  it('puts about the requested share of other photos into test, the same way every run', () => {
    const paths = Array.from({ length: 2000 }, (_, i) => `Rust/${i}.jpg`);
    const share = paths.filter((path) => splitOf(path, 0.2) === 'test').length / paths.length;
    expect(share).toBeGreaterThan(0.17);
    expect(share).toBeLessThan(0.23);
    expect(paths.map((path) => splitOf(path, 0.2))).toEqual(paths.map((path) => splitOf(path, 0.2)));
  });
});
