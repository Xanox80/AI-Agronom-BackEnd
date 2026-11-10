import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FieldLinkMethod, ObservationStatus, Role } from '../../domain/enums';
import { DomainEvent } from '../../domain/events';
import { CreateObservationDto } from './dto/create-observation.dto';
import { AuthUser } from './observation-access';
import { ObservationsService } from './observations.service';

const scout: AuthUser = { id: 'u1', farmId: 'f1', role: Role.Scout };
const dto = { clientId: 'c1', capturedAt: '2026-05-01T10:00:00Z', lat: 50, lng: 30 } as CreateObservationDto;
const resolved = {
  lat: 50, lng: 30, gpsAccuracyM: null, fieldId: 'fa', fieldLinkMethod: FieldLinkMethod.Gps, cropId: 'wheat',
  temperatureC: 15, humidityPct: 55,
};

describe('ObservationsService', () => {
  const build = (rows: Record<string, unknown>[] = []) => {
    const observations = {
      findOneBy: jest.fn(async (where: Record<string, unknown>) => rows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null),
      create: jest.fn((row) => ({ ...row })),
      save: jest.fn(async (row) => row),
      remove: jest.fn(),
    };
    const context = { resolve: jest.fn(async () => resolved), rememberCrop: jest.fn(), assertReferencesAllowed: jest.fn() };
    const media = { findForObservations: jest.fn(async () => ({ photos: [], voiceNotes: [] })), removeAll: jest.fn() };
    const mapper = { toDto: jest.fn((o) => ({ id: o.id, status: o.status })) };
    const events = { emit: jest.fn() };
    const service = new ObservationsService(observations as never, context as never, media as never, mapper as never, events as never);
    return { service, observations, context, media, events };
  };

  it('creates an observation with resolved metadata, the client id as row id and the user agent as device', async () => {
    const { service, observations, events } = build();
    await service.create(scout, dto, 'Pixel 8');
    expect(observations.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'c1', farmId: 'f1', userId: 'u1', fieldId: 'fa', deviceModel: 'Pixel 8', status: ObservationStatus.Synced, isQuickCapture: false,
    }));
    expect(events.emit).toHaveBeenCalledWith(DomainEvent.ObservationCreated, { observationId: 'c1', farmId: 'f1', userId: 'u1' });
  });

  it('marks mechanic observations as quick capture without a diagnosis', async () => {
    const { service, observations } = build();
    await service.create({ ...scout, role: Role.Mechanic }, dto);
    expect(observations.save).toHaveBeenCalledWith(expect.objectContaining({ isQuickCapture: true }));
  });

  it('is idempotent by clientId and does not emit twice', async () => {
    const { service, observations, events } = build([{ id: 'c1', clientId: 'c1', farmId: 'f1' }]);
    await service.create(scout, dto);
    expect(observations.save).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses a clientId that belongs to another farm', async () => {
    const { service } = build([{ id: 'c1', clientId: 'c1', farmId: 'other' }]);
    await expect(service.create(scout, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides observations of other farms', async () => {
    const { service } = build([{ id: 'o1', farmId: 'other' }]);
    await expect(service.get(scout, 'o1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets only the owner or the chief agronomist update, and switches the link to manual on field change', async () => {
    const row = { id: 'o1', farmId: 'f1', userId: 'someone-else', fieldId: null, cropId: null };
    const { service, observations } = build([row]);
    await expect(service.update(scout, 'o1', { textNote: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await service.update({ ...scout, role: Role.ChiefAgronomist }, 'o1', { fieldId: 'fb', textNote: 'x' });
    expect(observations.save).toHaveBeenCalledWith(expect.objectContaining({ fieldId: 'fb', fieldLinkMethod: FieldLinkMethod.Manual, textNote: 'x' }));
  });

  it('removes the media before the observation', async () => {
    const { service, media, observations } = build([{ id: 'o1', farmId: 'f1' }]);
    await service.remove(scout, 'o1');
    expect(media.removeAll).toHaveBeenCalledWith('o1');
    expect(observations.remove).toHaveBeenCalled();
  });
});
