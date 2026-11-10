import { BadRequestException } from '@nestjs/common';
import { zipSync } from 'fflate';
import type { FeatureCollection } from 'geojson';
import { FieldSource } from '../../../domain/enums';
import { fieldsSettings } from '../__fixtures__/settings';
import { polygonShapefileZip } from '../__fixtures__/shapefile-zip';
import { SQUARE } from '../__fixtures__/shapes';
import { ShapefileImporter, ZipParser } from './shapefile.importer';

const collection: FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { NAME: 'S' }, geometry: SQUARE }] };
const zip = Buffer.from(zipSync({ 'a.txt': new Uint8Array(10) }));
const settings = fieldsSettings();

describe('ShapefileImporter', () => {
  it('supports only .zip files', () => {
    const importer = new ShapefileImporter(settings, async () => collection);
    expect(importer.supports('fields.ZIP')).toBe(true);
    expect(importer.supports('fields.kml')).toBe(false);
  });

  it('flattens every layer of the archive into features', async () => {
    const importer = new ShapefileImporter(settings, async () => [collection, collection]);
    const parsed = await importer.parse(zip);
    expect(parsed.source).toBe(FieldSource.ImportShp);
    expect(parsed.features).toHaveLength(2);
  });

  it('reports an unreadable archive as a bad request', async () => {
    const importer = new ShapefileImporter(settings, async () => {
      throw new Error('corrupt');
    });
    await expect(importer.parse(zip)).rejects.toBeInstanceOf(BadRequestException);
    await expect(importer.parse(Buffer.from('not a zip'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an archive whose declared unpacked size exceeds the limit', async () => {
    const parser = jest.fn(async () => collection);
    const importer = new ShapefileImporter(fieldsSettings({ FIELDS_IMPORT_MAX_UNZIPPED_MB: '1' }), parser);
    const bomb = Buffer.from(zipSync({ 'big.bin': new Uint8Array(2 * 1024 * 1024) }));
    await expect(importer.parse(bomb)).rejects.toMatchObject({ response: { code: 'IMPORT_ARCHIVE_TOO_LARGE' } });
    expect(parser).not.toHaveBeenCalled();
  });

  it('parses a real zipped shapefile with shpjs', async () => {
    // jest cannot run the native dynamic import used by loadShpjsZipParser, so the CommonJS build stands in for it
    (globalThis as { self?: unknown }).self = globalThis;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseZip } = require('shpjs') as { parseZip: (bytes: ArrayBuffer) => Promise<FeatureCollection> };
    delete (globalThis as { self?: unknown }).self;
    const realParser: ZipParser = async (content) => parseZip(content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer);
    const parsed = await new ShapefileImporter(settings, realParser).parse(polygonShapefileZip(SQUARE.coordinates[0]));
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].geometry.type).toBe('Polygon');
  });
});
