import { NotFoundException } from '@nestjs/common';
import { FieldAccess } from './field-access';

describe('FieldAccess', () => {
  it('passes for a field of the farm', async () => {
    const access = new FieldAccess({ exist: jest.fn().mockResolvedValue(true) } as never);
    await expect(access.require('farm-1', 'f1')).resolves.toBeUndefined();
  });

  it('throws not found for a field of another farm', async () => {
    const access = new FieldAccess({ exist: jest.fn().mockResolvedValue(false) } as never);
    await expect(access.require('farm-1', 'f1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
