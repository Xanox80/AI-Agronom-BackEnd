import { fieldsSettings } from './__fixtures__/settings';

describe('FieldsSettings', () => {
  it('reads configured values and converts units', () => {
    const settings = fieldsSettings({ FIELDS_NEARBY_LIMIT: '3', FIELDS_NEARBY_MAX_KM: '2', FIELDS_IMPORT_MAX_MB: '1' });
    expect(settings.nearbyLimit).toBe(3);
    expect(settings.nearbyMaxMeters).toBe(2000);
    expect(settings.importMaxBytes).toBe(1024 * 1024);
    expect(settings.importFallbackName).toBe('Field');
  });

  it('fails fast for invalid values', () => {
    expect(() => fieldsSettings({ FIELDS_NEARBY_LIMIT: 'abc' }).nearbyLimit).toThrow('FIELDS_NEARBY_LIMIT');
  });
});
