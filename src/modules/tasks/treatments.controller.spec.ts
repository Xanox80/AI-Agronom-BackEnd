import { Role } from '../../domain/enums';
import { TreatmentsController } from './treatments.controller';

const req = { user: { id: 'u1', farmId: 'farm-1', role: Role.Scout } };

describe('TreatmentsController', () => {
  it('delegates list and create to the service with the authenticated actor', async () => {
    const service = { list: jest.fn().mockResolvedValue('list'), create: jest.fn().mockResolvedValue('create') };
    const controller = new TreatmentsController(service as never);
    await expect(controller.list(req, {} as never)).resolves.toBe('list');
    await expect(controller.create(req, {} as never)).resolves.toBe('create');
    expect(service.create).toHaveBeenCalledWith(req.user, {});
  });
});
