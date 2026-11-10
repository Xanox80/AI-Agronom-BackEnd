import { SQUARE } from './__fixtures__/shapes';
import { distanceToContourMeters } from './contour-distance';

describe('distanceToContourMeters', () => {
  it('measures to the nearest edge, not to the centre', () => {
    const metres = distanceToContourMeters(50.0045, 29.99, SQUARE);
    expect(metres).toBeGreaterThan(600);
    expect(metres).toBeLessThan(800);
  });

  it('is near zero on the boundary', () => {
    expect(distanceToContourMeters(50.0045, 30.0, SQUARE)).toBeLessThan(1);
  });

  it('uses the closest polygon of a MultiPolygon', () => {
    const multi = { type: 'MultiPolygon' as const, coordinates: [SQUARE.coordinates] };
    expect(distanceToContourMeters(50.0045, 29.99, multi)).toBeCloseTo(distanceToContourMeters(50.0045, 29.99, SQUARE), 6);
  });
});
