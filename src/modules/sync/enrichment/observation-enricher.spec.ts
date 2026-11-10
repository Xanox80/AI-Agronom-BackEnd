import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities';
import { FieldLinkMethod, Role } from '../../../domain/enums';
import { openTestDatabase } from '../__fixtures__/test-database';
import { ObservationPayloadDto } from '../dto/payloads.dto';
import { ObservationEnricher } from './observation-enricher';

describe('ObservationEnricher', () => {
  let db: DataSource;
  const farmId = randomUUID();
  const userId = randomUUID();
  let matches: { fieldId: string; name: string }[];
  let weather: { getCurrent: jest.Mock };
  let enricher: ObservationEnricher;

  const saveUser = (geoCollectionEnabled: boolean) => {
    const users = db.getRepository(UserEntity);
    return users.save(users.create({
      id: userId, farmId, email: 'a@b.c', passwordHash: 'x', displayName: 'A', role: Role.Scout, trustWeight: 1, locale: 'uk',
      geoCollectionEnabled, isActive: true,
    } as never));
  };

  const payload = (overrides: Partial<ObservationPayloadDto> = {}): ObservationPayloadDto =>
    ({ capturedAt: '2026-11-10T08:00:00.000Z', lat: 50, lng: 30, gpsAccuracyM: 4, ...overrides }) as ObservationPayloadDto;

  beforeEach(async () => {
    db = await openTestDatabase();
    matches = [];
    weather = { getCurrent: jest.fn().mockResolvedValue({ temperatureC: 18, humidityPct: 70 }) };
    const locator = { locate: async () => ({ matches, nearby: [] }) };
    enricher = new ObservationEnricher(db.getRepository(UserEntity), locator as never, weather as never);
    await saveUser(true);
  });

  afterEach(() => db.destroy());

  it('links the field containing the point', async () => {
    const fieldId = randomUUID();
    matches = [{ fieldId, name: 'F' }];

    expect(await enricher.enrich(farmId, userId, payload())).toMatchObject({ fieldId, fieldLinkMethod: FieldLinkMethod.Gps });
  });

  it('leaves the field unlinked when the point is inside several fields', async () => {
    matches = [{ fieldId: randomUUID(), name: 'A' }, { fieldId: randomUUID(), name: 'B' }];

    expect(await enricher.enrich(farmId, userId, payload())).toMatchObject({ fieldId: null, fieldLinkMethod: FieldLinkMethod.None });
  });

  it('keeps a field chosen by the client', async () => {
    const fieldId = randomUUID();
    matches = [{ fieldId: randomUUID(), name: 'Other' }];

    const result = await enricher.enrich(farmId, userId, payload({ fieldId, fieldLinkMethod: FieldLinkMethod.Manual }));

    expect(result).toMatchObject({ fieldId, fieldLinkMethod: FieldLinkMethod.Manual });
  });

  it('fills missing weather but never overrides client readings', async () => {
    const result = await enricher.enrich(farmId, userId, payload({ temperatureC: 5 }));

    expect(result).toMatchObject({ temperatureC: 5, humidityPct: 70 });
  });

  it('skips weather when the lookup fails', async () => {
    weather.getCurrent.mockRejectedValue(new Error('down'));

    expect(await enricher.enrich(farmId, userId, payload())).toMatchObject({ temperatureC: null, humidityPct: null });
  });

  it('still links the field but stores no coordinates when geo collection is off', async () => {
    await saveUser(false);
    const fieldId = randomUUID();
    matches = [{ fieldId, name: 'F' }];

    expect(await enricher.enrich(farmId, userId, payload())).toMatchObject({ fieldId, lat: null, lng: null, gpsAccuracyM: null });
  });

  it('keeps coordinates when geo collection is on', async () => {
    expect(await enricher.enrich(farmId, userId, payload())).toMatchObject({ lat: 50, lng: 30, gpsAccuracyM: 4 });
  });
});
