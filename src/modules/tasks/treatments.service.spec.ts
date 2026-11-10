import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../../domain/enums';
import { TaskActor } from './task-actor';
import { TasksSettings } from './tasks.settings';
import { TreatmentsService } from './treatments.service';

const actor: TaskActor = { id: 'u1', farmId: 'farm-1', role: Role.Scout };
const input = {
  clientId: 'c1', fieldId: 'f1', productId: 'p1', doseValue: 0.5, doseUnit: 'l/ha', treatedAreaHa: 12, appliedAt: '2026-06-01T08:00:00Z',
};

function build() {
  const treatments = {
    findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]), create: jest.fn((v) => v), save: jest.fn(async (v) => v),
  };
  const fieldAccess = { require: jest.fn().mockResolvedValue(undefined) };
  const products = { findOne: jest.fn().mockResolvedValue({ id: 'p1', name: 'Demo' }), find: jest.fn().mockResolvedValue([]) };
  const links = { find: jest.fn().mockResolvedValue([{ activeSubstanceId: 's1' }, { activeSubstanceId: 's2' }]) };
  const substances = {
    find: jest.fn().mockResolvedValue([
      { code: 'tebuconazole', resistanceSystem: 'FRAC', resistanceGroup: '3' },
      { code: 'sulphur', resistanceSystem: 'none', resistanceGroup: '' },
    ]),
  };
  const service = new TreatmentsService(
    treatments as never, products as never, links as never, substances as never, fieldAccess as never,
    new TasksSettings({ get: () => undefined } as never),
  );
  return { service, treatments, fieldAccess, products };
}

describe('TreatmentsService', () => {
  it('records substances and resistance groups of the product', async () => {
    const { service, treatments } = build();
    await service.record(actor, input);
    expect(treatments.save).toHaveBeenCalledWith(expect.objectContaining({
      activeSubstanceCodes: ['tebuconazole', 'sulphur'], resistanceGroups: [{ system: 'FRAC', group: '3' }],
      appliedAt: '2026-06-01', recordedByUserId: 'u1', taskId: null,
    }));
  });

  it('returns the existing row when the clientId was already recorded', async () => {
    const { service, treatments } = build();
    treatments.findOne.mockResolvedValue({ id: 'c1' });
    await expect(service.record(actor, input)).resolves.toEqual({ id: 'c1' });
    expect(treatments.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown product', async () => {
    const { service, products } = build();
    products.findOne.mockResolvedValue(null);
    await expect(service.record(actor, input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a field outside the farm', async () => {
    const { service, fieldAccess } = build();
    fieldAccess.require.mockRejectedValue(new NotFoundException());
    await expect(service.record(actor, input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reads the season history of a field from the season start', async () => {
    const { service, treatments } = build();
    await service.getTreatments('f1', '2026-03-01T00:00:00Z');
    const where = treatments.find.mock.calls[0][0].where;
    expect(where.fieldId).toBe('f1');
    expect(where.appliedAt.value).toBe('2026-03-01');
  });

  it('lists farm treatments with a date range and pagination', async () => {
    const { service, treatments } = build();
    await service.list(actor, { page: 1, pageSize: 20, fieldId: 'f1', from: '2026-03-01', to: '2026-09-01' });
    expect(treatments.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ farmId: 'farm-1', fieldId: 'f1' }), skip: 0, take: 20,
    }));
  });
});
