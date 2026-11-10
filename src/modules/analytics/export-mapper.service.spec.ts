import { ConfigService } from '@nestjs/config';
import { ObservationEntity, TaskEntity, TreatmentEntity } from '../../domain/entities';
import { ExportLookup } from './export-lookup.service';
import { ExportMapper } from './export-mapper.service';
import { ObservationDiagnosisResolver } from './observation-diagnosis.resolver';

describe('ExportMapper', () => {
  const lookup = {
    cropCodes: async () => new Map([['c1', 'wheat_winter']]),
    diagnosisCodes: async () => new Map([['d1', 'rust']]),
    userIdentities: async () => new Map([['u1', { email: 'a@b.ua', displayName: 'Ann' }]]),
    productsById: async () => new Map([['p1', { registrationNumber: 'R-1', name: 'Prod' }]]),
    photoIdsByObservation: async () => new Map([['o1', ['ph1', 'ph2']]]),
  } as unknown as ExportLookup;
  const resolver = {
    resolve: async () => new Map([['o1', { code: 'rust' }]]),
  } as unknown as ObservationDiagnosisResolver;
  const config = { get: () => ({ apiPrefix: 'api/v1' }) } as unknown as ConfigService<never, true>;
  const mapper = new ExportMapper(lookup, resolver, config as never);
  const updatedAt = new Date('2026-11-10T08:00:00Z');

  it('maps an observation to codes, emails and photo URLs without internal user ids', async () => {
    const [dto] = await mapper.observations('farm', [{
      id: 'o1', userId: 'u1', cropId: 'c1', fieldId: 'f1', confirmedDiagnosisId: null, capturedAt: updatedAt, updatedAt,
      lat: 1, lng: 2, bbchStage: 30, temperatureC: null, humidityPct: null, textNote: null,
    } as ObservationEntity]);
    expect(dto).toMatchObject({
      schemaVersion: 1, externalIds: { scoutId: 'o1' }, cropCode: 'wheat_winter', diagnosisCode: 'rust', confirmed: false,
      userEmail: 'a@b.ua', displayName: 'Ann', photoUrls: ['/api/v1/photos/ph1/file', '/api/v1/photos/ph2/file'],
      capturedAt: '2026-11-10T08:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('userId');
  });

  it('maps a task with diagnosis code, assignee email and nullable dates', async () => {
    const [dto] = await mapper.tasks('farm', [{
      id: 't1', diagnosisId: 'd1', assigneeUserId: 'u1', photoIds: ['ph1'], deadline: null, completedAt: null,
      updatedAt, fieldId: 'f1', title: 'T', notes: '',
    } as unknown as TaskEntity]);
    expect(dto).toMatchObject({ diagnosisCode: 'rust', assigneeEmail: 'a@b.ua', deadline: null, photoUrls: ['/api/v1/photos/ph1/file'] });
  });

  it('maps a treatment to the product registration number', async () => {
    const [dto] = await mapper.treatments('farm', [{
      id: 'tr1', productId: 'p1', recordedByUserId: 'u1', updatedAt, appliedAt: '2026-11-01', activeSubstanceCodes: ['x'],
    } as unknown as TreatmentEntity]);
    expect(dto).toMatchObject({ productRegistrationNumber: 'R-1', productName: 'Prod', recordedByEmail: 'a@b.ua', appliedAt: '2026-11-01' });
  });
});
