import { BadRequestException } from '@nestjs/common';
import { SQUARE } from './__fixtures__/shapes';
import { FieldGeometryService } from './field-geometry.service';

describe('FieldGeometryService', () => {
  const service = new FieldGeometryService();

  it('computes hectares, bbox and centre of a polygon', () => {
    const shape = service.describe(SQUARE);
    expect(shape.areaHa).toBeGreaterThan(95);
    expect(shape.areaHa).toBeLessThan(105);
    expect(shape.bbox).toEqual([30, 50, 30.014, 50.009]);
    expect(shape.centroid.lng).toBeCloseTo(30.007, 6);
    expect(shape.centroid.lat).toBeCloseTo(50.0045, 6);
  });

  it('accepts a MultiPolygon', () => {
    const shape = service.describe({ type: 'MultiPolygon', coordinates: [SQUARE.coordinates] });
    expect(shape.bbox).toEqual([30, 50, 30.014, 50.009]);
  });

  it.each([
    ['a point', { type: 'Point', coordinates: [30, 50] }],
    ['null', null],
    ['a ring that is too short', { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] }],
    ['non-numeric coordinates', { type: 'Polygon', coordinates: [[['a', 0], [1, 1], [2, 2], ['a', 0]]] }],
    ['longitude out of range', { type: 'Polygon', coordinates: [[[200, 0], [201, 0], [201, 1], [200, 0]]] }],
    ['latitude out of range', { type: 'Polygon', coordinates: [[[0, 91], [1, 91], [1, 92], [0, 91]]] }],
    ['an unclosed ring', { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }],
    ['a short inner ring', { type: 'Polygon', coordinates: [SQUARE.coordinates[0], [[30, 50], [30.001, 50]]] }],
    ['an empty MultiPolygon', { type: 'MultiPolygon', coordinates: [] }],
  ])('rejects %s', (_label, geometry) => {
    expect(() => service.describe(geometry)).toThrow(BadRequestException);
  });

  it('drops altitude from KML-style 3D positions', () => {
    const shape = service.describe({ type: 'Polygon', coordinates: [SQUARE.coordinates[0].map(([lng, lat]) => [lng, lat, 120])] });
    expect(shape.contour).toEqual(SQUARE);
    expect(shape.bbox).toEqual([30, 50, 30.014, 50.009]);
  });
});
