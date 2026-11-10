import { FieldLinkMethod, Role } from '../../domain/enums';
import { CreateObservationDto } from './dto/create-observation.dto';
import { AuthUser } from './observation-access';
import { ObservationContextResolver } from './observation-context.resolver';

describe('ObservationContextResolver', () => {
  const user: AuthUser = { id: 'u1', farmId: 'f1', role: Role.Scout };
  const base = { clientId: 'c', capturedAt: '2026-05-01T10:00:00Z' } as CreateObservationDto;
  const point = { ...base, lat: 50.1, lng: 30.2, gpsAccuracyM: 5 } as CreateObservationDto;

  const build = (opts: { matches?: { fieldId: string; cropId?: string }[]; memoryCrop?: string; foreignField?: boolean; weather?: unknown } = {}) => {
    const memory = {
      findOneBy: jest.fn().mockResolvedValue(opts.memoryCrop ? { cropId: opts.memoryCrop } : null),
      create: jest.fn((row) => row), save: jest.fn(),
    };
    const fieldRepo = { findOneBy: jest.fn(async () => opts.foreignField ? null : {}) };
    const cropRepo = { findOneBy: jest.fn(async () => ({})) };
    const fields = { locate: jest.fn().mockResolvedValue(opts.matches ?? []) };
    const weather = { at: jest.fn().mockResolvedValue(opts.weather ?? null) };
    return { memory, fieldRepo, fields, weather, resolver: new ObservationContextResolver(memory as never, fieldRepo as never, cropRepo as never, fields, weather) };
  };

  it('links the field by GPS when exactly one polygon contains the point and takes its crop', async () => {
    const { resolver } = build({ matches: [{ fieldId: 'fa', cropId: 'wheat' }] });
    const result = await resolver.resolve(user, point);
    expect(result).toMatchObject({ fieldId: 'fa', fieldLinkMethod: FieldLinkMethod.Gps, cropId: 'wheat' });
  });

  it('leaves the field unlinked when several or no polygons match', async () => {
    const { resolver } = build({ matches: [{ fieldId: 'a' }, { fieldId: 'b' }] });
    expect(await resolver.resolve(user, point)).toMatchObject({ fieldId: null, fieldLinkMethod: FieldLinkMethod.None });
  });

  it('keeps a manual field and prefers the crop remembered for that field', async () => {
    const { resolver, fields } = build({ memoryCrop: 'maize' });
    const result = await resolver.resolve(user, { ...point, fieldId: 'fm' });
    expect(result).toMatchObject({ fieldId: 'fm', fieldLinkMethod: FieldLinkMethod.Manual, cropId: 'maize' });
    expect(fields.locate).not.toHaveBeenCalled();
  });

  it('fills temperature and humidity from weather only when the client omitted them', async () => {
    const { resolver } = build({ weather: { temperatureC: 18, humidityPct: 60 } });
    expect(await resolver.resolve(user, point)).toMatchObject({ temperatureC: 18, humidityPct: 60 });
    expect(await resolver.resolve(user, { ...point, temperatureC: 5, humidityPct: 90 })).toMatchObject({ temperatureC: 5, humidityPct: 90 });
  });

  it('survives a weather failure', async () => {
    const { resolver, weather } = build();
    weather.at.mockRejectedValue(new Error('down'));
    expect(await resolver.resolve(user, point)).toMatchObject({ temperatureC: null, humidityPct: null });
  });

  it('stores no coordinates and skips GPS linking when the user opted out of geo', async () => {
    const { resolver, fields, weather } = build({ matches: [{ fieldId: 'fa' }] });
    const result = await resolver.resolve({ ...user, geoCollectionEnabled: false }, point);
    expect(result).toMatchObject({ lat: null, lng: null, gpsAccuracyM: null, fieldId: null });
    expect(fields.locate).not.toHaveBeenCalled();
    expect(weather.at).not.toHaveBeenCalled();
  });

  it('rejects a field that is not in the farm', async () => {
    const { resolver } = build({ foreignField: true });
    await expect(resolver.assertReferencesAllowed('f1', 'other', null)).rejects.toThrow('FIELD_NOT_FOUND');
  });

  it('works without the optional fields and weather providers', async () => {
    const memory = { findOneBy: jest.fn(), create: jest.fn(), save: jest.fn() };
    const resolver = new ObservationContextResolver(memory as never, {} as never, {} as never);
    expect(await resolver.resolve(user, point)).toMatchObject({ fieldId: null, temperatureC: null });
  });

  it('remembers the crop per user and field, updating an existing row', async () => {
    const { resolver, memory } = build({ memoryCrop: 'old' });
    await resolver.rememberCrop(user, 'fa', 'new');
    expect(memory.save).toHaveBeenCalledWith(expect.objectContaining({ cropId: 'new' }));
    await resolver.rememberCrop(user, null, 'new');
    expect(memory.save).toHaveBeenCalledTimes(1);
  });
});
