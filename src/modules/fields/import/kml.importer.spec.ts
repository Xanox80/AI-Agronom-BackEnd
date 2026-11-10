import { BadRequestException } from '@nestjs/common';
import { FieldSource } from '../../../domain/enums';
import { KmlImporter } from './kml.importer';

const KML = [
  '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>North</name>',
  '<Polygon><outerBoundaryIs><LinearRing><coordinates>30,50,0 30,50.009,0 30.014,50.009,0 30,50,0</coordinates></LinearRing></outerBoundaryIs></Polygon>',
  '</Placemark></Document></kml>',
].join('\n');

describe('KmlImporter', () => {
  const importer = new KmlImporter();

  it('supports only .kml files', () => {
    expect(importer.supports('x.KML')).toBe(true);
    expect(importer.supports('x.zip')).toBe(false);
  });

  it('converts placemarks to polygon features with their names', async () => {
    const parsed = await importer.parse(Buffer.from(KML));
    expect(parsed.source).toBe(FieldSource.ImportKml);
    expect(parsed.features[0].properties?.name).toBe('North');
    expect(parsed.features[0].geometry.type).toBe('Polygon');
  });

  it('rejects content that is not XML', async () => {
    await expect(importer.parse(Buffer.from(''))).rejects.toBeInstanceOf(BadRequestException);
  });
});
