import { Repository } from 'typeorm';
import { FieldEntity } from '../../domain/entities';
import { fieldsSettings } from './__fixtures__/settings';
import { SQUARE, SQUARE_CENTRE } from './__fixtures__/shapes';
import { FieldGeometryService } from './field-geometry.service';
import { FieldLocatorService } from './field-locator.service';

const geometry = new FieldGeometryService();

function fieldAt(id: string, lngShift: number): FieldEntity {
  const shifted = { type: 'Polygon', coordinates: [SQUARE.coordinates[0].map(([lng, lat]) => [lng + lngShift, lat])] };
  const shape = geometry.describe(shifted);
  return { id, name: id, contour: shape.contour, bbox: shape.bbox, centroidLat: shape.centroid.lat, centroidLng: shape.centroid.lng } as FieldEntity;
}

function locator(fields: FieldEntity[], env: Record<string, string> = {}) {
  const repo = { find: async () => fields } as unknown as Repository<FieldEntity>;
  return new FieldLocatorService(repo, fieldsSettings(env));
}

describe('FieldLocatorService', () => {
  it('returns the field whose polygon contains the point and no fallback list', async () => {
    const result = await locator([fieldAt('inside', 0), fieldAt('far', 1)]).locate('farm', SQUARE_CENTRE.lat, SQUARE_CENTRE.lng);
    expect(result.matches).toEqual([{ fieldId: 'inside', name: 'inside' }]);
    expect(result.nearby).toEqual([]);
  });

  it('falls back to nearby fields sorted by distance when no polygon contains the point', async () => {
    const result = await locator([fieldAt('b', 0.04), fieldAt('a', 0.02)]).locate('farm', SQUARE_CENTRE.lat, SQUARE_CENTRE.lng);
    expect(result.matches).toEqual([]);
    expect(result.nearby.map((c) => c.fieldId)).toEqual(['a', 'b']);
    expect(result.nearby[0].distanceM).toBeLessThan(result.nearby[1].distanceM);
  });

  it('drops candidates beyond the configured radius and caps the list length', async () => {
    const fields = [fieldAt('a', 0.02), fieldAt('b', 0.04), fieldAt('far', 1)];
    const result = await locator(fields, { FIELDS_NEARBY_LIMIT: '1' }).locate('farm', SQUARE_CENTRE.lat, SQUARE_CENTRE.lng);
    expect(result.nearby.map((c) => c.fieldId)).toEqual(['a']);
  });

  it('measures the fallback distance to the polygon edge, not to its centre', async () => {
    const result = await locator([fieldAt('near-edge', 0)]).locate('farm', SQUARE_CENTRE.lat, 29.9985);
    expect(result.nearby[0].distanceM).toBeLessThan(200);
  });
});
