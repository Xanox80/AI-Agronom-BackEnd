import { assertValidRegion } from './region';

const pt = (x: number, y: number) => ({ x, y });

describe('assertValidRegion', () => {
  it('accepts a two-corner rect and a triangle polygon', () => {
    expect(() => assertValidRegion({ type: 'rect', photoSeq: 1, points: [pt(0, 0), pt(0.5, 0.5)] })).not.toThrow();
    expect(() => assertValidRegion({ type: 'polygon', photoSeq: 1, points: [pt(0, 0), pt(1, 0), pt(0.5, 1)] })).not.toThrow();
  });

  it('rejects coordinates outside 0..1', () => {
    expect(() => assertValidRegion({ type: 'rect', photoSeq: 1, points: [pt(0, 0), pt(1.2, 0.5)] })).toThrow();
  });

  it('rejects a polygon with fewer than three points', () => {
    expect(() => assertValidRegion({ type: 'polygon', photoSeq: 1, points: [pt(0, 0), pt(1, 1)] })).toThrow();
  });

  it('rejects a rect that is not exactly two points', () => {
    expect(() => assertValidRegion({ type: 'rect', photoSeq: 1, points: [pt(0, 0), pt(1, 1), pt(1, 0)] })).toThrow();
  });
});
