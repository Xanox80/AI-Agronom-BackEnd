import { pointGeometry, toFeatureCollection } from './geojson-writer';

describe('geojson-writer', () => {
  it('builds a point in lng/lat order and null geometry without coordinates', () => {
    expect(pointGeometry({ lat: 50, lng: 30 })).toEqual({ type: 'Point', coordinates: [30, 50] });
    expect(pointGeometry({ lat: null, lng: 30 })).toBeNull();
  });

  it('puts the DTO minus geometry into properties and the scout id into the feature id', () => {
    const geometry = { type: 'Point' as const, coordinates: [1, 2] };
    const collection = toFeatureCollection(
      [{ externalIds: { scoutId: 'f1' }, name: 'A', geometry }],
      (item) => item.geometry,
    );
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features[0]).toEqual({
      type: 'Feature', id: 'f1', geometry, properties: { externalIds: { scoutId: 'f1' }, name: 'A' },
    });
  });
});
