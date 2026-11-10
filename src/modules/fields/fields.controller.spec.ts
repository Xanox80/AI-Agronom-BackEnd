import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../domain/enums';
import { ROLES_KEY } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { FieldImportService } from './field-import.service';
import { FieldLocatorService } from './field-locator.service';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';

const user = { id: 'u', farmId: 'farm' } as AuthUser;

function build() {
  const fields = { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), rememberCrop: jest.fn(async () => undefined) };
  const importer = { import: jest.fn(async () => ({ imported: [], skipped: [] })) };
  const controller = new FieldsController(fields as unknown as FieldsService, importer as unknown as FieldImportService, {} as FieldLocatorService);
  return { controller, fields, importer };
}

function rolesOf(handler: keyof FieldsController): Role[] | undefined {
  return new Reflector().get<Role[]>(ROLES_KEY, FieldsController.prototype[handler]);
}

describe('FieldsController', () => {
  it('gates writes by role as in the architecture contract', () => {
    expect(rolesOf('import')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('remove')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('create')).toEqual([Role.Scout, Role.ChiefAgronomist]);
    expect(rolesOf('update')).toEqual([Role.Scout, Role.ChiefAgronomist]);
    expect(rolesOf('list')).toBeUndefined();
  });

  it('answers 204 for delete and crop-memory writes', () => {
    const status = (handler: keyof FieldsController) => Reflect.getMetadata('__httpCode__', FieldsController.prototype[handler]);
    expect(status('remove')).toBe(204);
    expect(status('rememberCrop')).toBe(204);
  });

  it('passes the caller farm and user to create and update', async () => {
    const { controller, fields } = build();
    await controller.create(user, { name: 'N' });
    await controller.update(user, 'id', { name: 'M' });
    expect(fields.create).toHaveBeenCalledWith('farm', { name: 'N' }, 'u');
    expect(fields.update).toHaveBeenCalledWith('farm', 'id', { name: 'M' }, 'u');
  });

  it('requires a file for import and treats dryRun=true as a preview', async () => {
    const { controller, importer } = build();
    await expect(controller.import(user, undefined, {})).rejects.toBeInstanceOf(BadRequestException);
    const file = { originalname: 'a.kml', buffer: Buffer.from('x') } as Express.Multer.File;
    await controller.import(user, file, { dryRun: 'true' });
    expect(importer.import).toHaveBeenCalledWith('farm', 'a.kml', file.buffer, true, 'u');
  });
});
