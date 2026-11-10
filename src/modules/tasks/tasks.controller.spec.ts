import { Role } from '../../domain/enums';
import { TasksController } from './tasks.controller';

const req = { user: { id: 'u1', farmId: 'farm-1', role: Role.ChiefAgronomist } };

describe('TasksController', () => {
  it('delegates each route to the service with the authenticated actor', async () => {
    const service = {
      list: jest.fn().mockResolvedValue('list'), get: jest.fn().mockResolvedValue('get'), create: jest.fn().mockResolvedValue('create'),
      update: jest.fn().mockResolvedValue('update'), complete: jest.fn().mockResolvedValue('complete'), remove: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new TasksController(service as never);
    await expect(controller.list(req, {} as never)).resolves.toBe('list');
    await expect(controller.get(req, 'id')).resolves.toBe('get');
    await expect(controller.create(req, {} as never)).resolves.toBe('create');
    await expect(controller.update(req, 'id', {})).resolves.toBe('update');
    await expect(controller.complete(req, 'id', {})).resolves.toBe('complete');
    await controller.remove(req, 'id');
    expect(service.remove).toHaveBeenCalledWith(req.user, 'id');
  });
});
