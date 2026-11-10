import { UserDto } from '../../domain/types';
import { ExportApiController } from './export-api.controller';

describe('ExportApiController', () => {
  const user = { farmId: 'farm-1' } as UserDto;
  const exports = { page: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1, deleted: [] }) };
  const controller = new ExportApiController(exports as never);

  it.each([
    ['fields', () => controller.fields(user, { page: 2 })],
    ['observations', () => controller.observations(user, { page: 2 })],
    ['tasks', () => controller.tasks(user, { page: 2 })],
    ['treatments', () => controller.treatments(user, { page: 2 })],
  ])('serves %s pages for the caller farm', async (kind, call) => {
    await call();
    expect(exports.page).toHaveBeenLastCalledWith(kind, 'farm-1', { page: 2 });
  });
});
