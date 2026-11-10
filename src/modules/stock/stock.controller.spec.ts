import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/auth.constants';
import { Role } from '../../domain/enums';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockSettings } from './stock.settings';

const user = { id: 'u', farmId: 'farm-1', role: Role.ChiefAgronomist, email: 'e' };
const rolesOf = (method: keyof StockController) => Reflect.getMetadata(ROLES_KEY, StockController.prototype[method]);

describe('StockController', () => {
  const service = { list: jest.fn(), upsert: jest.fn(), remove: jest.fn(), importCsv: jest.fn() };
  const settings = { maxImportKb: 1 } as StockSettings;
  const controller = new StockController(service as unknown as StockService, settings);

  beforeEach(() => jest.resetAllMocks());

  it('restricts writes to the chief agronomist and leaves reads open', () => {
    expect(rolesOf('upsert')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('remove')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('importCsv')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('list')).toBeUndefined();
  });

  it('scopes every call to the farm of the authenticated user', async () => {
    await controller.list(user, { page: 1 });
    await controller.upsert(user, 'p', { quantity: 1, unit: 'l' });
    await controller.remove(user, 'i');

    expect(service.list).toHaveBeenCalledWith('farm-1', { page: 1 });
    expect(service.upsert).toHaveBeenCalledWith('farm-1', 'p', { quantity: 1, unit: 'l' });
    expect(service.remove).toHaveBeenCalledWith('farm-1', 'i');
  });

  it('answers DELETE with 204', () => {
    expect(Reflect.getMetadata('__httpCode__', StockController.prototype.remove)).toBe(204);
  });

  it('passes the uploaded CSV text to the service', async () => {
    const file = { size: 3, buffer: Buffer.from('a,b') } as Express.Multer.File;
    await controller.importCsv(user, file);
    expect(service.importCsv).toHaveBeenCalledWith('farm-1', 'a,b');
  });

  it('rejects a missing or oversized CSV file', () => {
    expect(() => controller.importCsv(user, undefined)).toThrow(BadRequestException);
    expect(() => controller.importCsv(user, { size: 5000 } as Express.Multer.File)).toThrow(BadRequestException);
  });
});
