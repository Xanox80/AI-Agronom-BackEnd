import { BadRequestException } from '@nestjs/common';
import { FieldSource } from '../../domain/enums';
import { fieldsSettings } from './__fixtures__/settings';
import { SQUARE } from './__fixtures__/shapes';
import { FieldGeometryService } from './field-geometry.service';
import { FieldImportService } from './field-import.service';
import { FieldImporter } from './import/field-importer';
import { FieldsService } from './fields.service';

describe('FieldImportService', () => {
  const features = [
    { type: 'Feature' as const, properties: { name: ' North ' }, geometry: SQUARE },
    { type: 'Feature' as const, properties: {}, geometry: SQUARE },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [1, 1] } },
  ];
  const importer: FieldImporter = {
    supports: (name) => name.endsWith('.geojson'),
    parse: async () => ({ source: FieldSource.ImportGeojson, features }),
  };
  const create = jest.fn(async (_farmId: string, input: { name: string }) => ({ id: 'id', name: input.name }));
  const service = new FieldImportService([importer], new FieldGeometryService(), { create } as unknown as FieldsService, fieldsSettings({ FIELDS_NAME_MAX_LENGTH: '10' }));

  beforeEach(() => create.mockClear());

  it('saves polygon features, names them from properties and skips other geometries', async () => {
    const result = await service.import('farm', 'a.geojson', Buffer.from(''), false);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.imported.map((f) => f.name)).toEqual(['North', 'Field 2']);
    expect(result.skipped).toEqual([{ index: 2, reason: 'geometry is not a polygon' }]);
  });

  it('previews without saving when dryRun is set', async () => {
    const result = await service.import('farm', 'a.geojson', Buffer.from(''), true);
    expect(create).not.toHaveBeenCalled();
    expect(result.imported[0]).toMatchObject({ name: 'North', source: FieldSource.ImportGeojson });
    expect(result.imported[0].areaHa).toBeGreaterThan(0);
    expect(result.imported[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an unsupported file extension', async () => {
    await expect(service.import('farm', 'a.txt', Buffer.from(''), false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips features whose name exceeds the limit', async () => {
    const long = { ...importer, parse: async () => ({ source: FieldSource.ImportGeojson, features: [{ ...features[0], properties: { name: 'x'.repeat(11) } }] }) };
    const result = await new FieldImportService([long], new FieldGeometryService(), { create } as unknown as FieldsService, fieldsSettings({ FIELDS_NAME_MAX_LENGTH: '10' }))
      .import('farm', 'a.geojson', Buffer.from(''), false);
    expect(result.skipped).toEqual([{ index: 0, reason: 'name is too long' }]);
    expect(create).not.toHaveBeenCalled();
  });

  it('skips features with out-of-range coordinates and passes the user through', async () => {
    const bad = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[200, 0], [201, 0], [201, 1], [200, 0]]] } };
    const mixed = { ...importer, parse: async () => ({ source: FieldSource.ImportGeojson, features: [bad, features[0]] }) };
    const result = await new FieldImportService([mixed], new FieldGeometryService(), { create } as unknown as FieldsService, fieldsSettings())
      .import('farm', 'a.geojson', Buffer.from(''), false, 'user');
    expect(result.skipped).toHaveLength(1);
    expect(create).toHaveBeenCalledWith('farm', expect.objectContaining({ name: 'North' }), 'user');
  });
});
