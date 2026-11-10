import { BadRequestException } from '@nestjs/common';
import { FieldSource } from '../../../domain/enums';
import { SQUARE } from '../__fixtures__/shapes';
import { GeoJsonImporter } from './geojson.importer';

const buffer = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

describe('GeoJsonImporter', () => {
  const importer = new GeoJsonImporter();

  it('supports .geojson and .json files case-insensitively', () => {
    expect(importer.supports('a.GeoJSON')).toBe(true);
    expect(importer.supports('a.json')).toBe(true);
    expect(importer.supports('a.kml')).toBe(false);
  });

  it('reads a FeatureCollection', async () => {
    const collection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'A' }, geometry: SQUARE }] };
    const parsed = await importer.parse(buffer(collection));
    expect(parsed.source).toBe(FieldSource.ImportGeojson);
    expect(parsed.features).toHaveLength(1);
  });

  it('wraps a bare geometry into a feature', async () => {
    expect((await importer.parse(buffer(SQUARE))).features[0].geometry).toEqual(SQUARE);
  });

  it('rejects malformed JSON', async () => {
    await expect(importer.parse(buffer('{nope'))).rejects.toBeInstanceOf(BadRequestException);
  });
});
