import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CropEntity, FieldEntity } from '../../domain/entities';
import { fieldsSettings } from './__fixtures__/settings';
import { SQUARE } from './__fixtures__/shapes';
import { CropMemoryService } from './crop-memory.service';
import { FieldGeometryService } from './field-geometry.service';
import { FieldsService } from './fields.service';

function build(rows: FieldEntity[] = []) {
  const fields = {
    create: (partial: Partial<FieldEntity>) => ({ ...partial }) as FieldEntity,
    findOneBy: jest.fn(async (where: Record<string, unknown>) =>
      rows.find((r) => Object.entries(where).every(([k, v]) => k === 'deletedAt' || (r as unknown as Record<string, unknown>)[k] === v)) ?? null),
    findAndCount: jest.fn(async (_options: unknown) => [rows, rows.length]),
    save: jest.fn(async (e: FieldEntity) => e),
    update: jest.fn(async () => undefined),
  };
  const crops = {
    find: async () => [{ id: 'crop-1', code: 'maize' }],
    findOneBy: async ({ id }: { id: string }) => (id === 'crop-1' ? { id, code: 'maize' } : null),
  };
  const memory = { remember: jest.fn(async () => undefined), recall: jest.fn(async () => ({ cropId: 'crop-1' })) };
  const service = new FieldsService(
    fields as unknown as Repository<FieldEntity>, crops as unknown as Repository<CropEntity>,
    new FieldGeometryService(), memory as unknown as CropMemoryService, fieldsSettings({ FIELDS_NAME_MAX_LENGTH: '10' }),
  );
  return { service, fields, memory };
}

describe('FieldsService', () => {
  it('computes area, bbox and centroid from the contour on create', async () => {
    const { service } = build();
    const dto = await service.create('farm', { name: 'North', contour: SQUARE, areaHa: 1, cropId: 'crop-1' });
    expect(dto.areaHa).toBeGreaterThan(95);
    expect(dto.centroid?.lng).toBeCloseTo(30.007, 6);
    expect(dto.cropCode).toBe('maize');
    expect(dto.id).toBe(dto.clientId);
  });

  it('keeps the manual area when there is no contour', async () => {
    const { service } = build();
    expect((await service.create('farm', { name: 'South', areaHa: 12.5 })).areaHa).toBe(12.5);
  });

  it('returns the existing field when the same farm replays the clientId', async () => {
    const existing = { id: 'c', clientId: 'c', farmId: 'farm', name: 'Old' } as FieldEntity;
    const { service, fields } = build([existing]);
    const dto = await service.create('farm', { name: 'New', clientId: 'c' });
    expect(dto.name).toBe('Old');
    expect(fields.save).not.toHaveBeenCalled();
  });

  it('rejects a clientId that belongs to another farm without touching its row', async () => {
    const { service, fields } = build([{ id: 'c', clientId: 'c', farmId: 'farm-a', name: 'A' } as FieldEntity]);
    await expect(service.create('farm-b', { name: 'B', clientId: 'c' })).rejects.toBeInstanceOf(ConflictException);
    expect(fields.save).not.toHaveBeenCalled();
  });

  it('tells the caller when the replayed clientId was soft-deleted', async () => {
    const { service } = build([{ id: 'c', clientId: 'c', farmId: 'farm', deletedAt: new Date() } as FieldEntity]);
    await expect(service.create('farm', { name: 'N', clientId: 'c' })).rejects.toMatchObject({ response: { code: 'FIELD_DELETED' } });
  });

  it('rejects a cropId missing from the catalogue on create and update', async () => {
    const { service } = build([{ id: 'f', farmId: 'farm', name: 'Old' } as FieldEntity]);
    await expect(service.create('farm', { name: 'N', cropId: 'ghost' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('farm', 'f', { cropId: 'ghost' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remembers the crop for the user when a field is created or updated with a cropId', async () => {
    const { service, memory } = build([{ id: 'f', farmId: 'farm', name: 'Old' } as FieldEntity]);
    await service.create('farm', { name: 'N', cropId: 'crop-1' }, 'user');
    await service.update('farm', 'f', { cropId: 'crop-1' }, 'user');
    expect(memory.remember).toHaveBeenCalledTimes(2);
  });

  it('does not touch crop memory without a cropId', async () => {
    const { service, memory } = build();
    await service.create('farm', { name: 'N' }, 'user');
    expect(memory.remember).not.toHaveBeenCalled();
  });

  it('rejects names longer than the configured limit', async () => {
    await expect(build().service.create('farm', { name: 'x'.repeat(11) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates the crop and the field before remembering a crop', async () => {
    const { service, memory } = build([{ id: 'f', farmId: 'farm' } as FieldEntity]);
    await service.rememberCrop('farm', 'user', 'f', 'crop-1');
    expect(memory.remember).toHaveBeenCalledTimes(1);
    await expect(service.rememberCrop('farm', 'user', 'f', 'ghost')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rememberCrop('other', 'user', 'f', 'crop-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recalls the remembered crop of a field in the caller farm', async () => {
    const { service } = build([{ id: 'f', farmId: 'farm' } as FieldEntity]);
    expect(await service.recallCrop('farm', 'user', 'f')).toEqual({ cropId: 'crop-1' });
  });

  it('caps the page size at the configured maximum', async () => {
    const { service, fields } = build();
    const page = await service.list('farm', { pageSize: 5000 });
    expect(page.pageSize).toBe(100);
    expect(fields.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100, skip: 0 }));
  });

  it('updates only the provided properties', async () => {
    const { service } = build([{ id: 'f', farmId: 'farm', name: 'Old', variety: 'x' } as FieldEntity]);
    expect(await service.update('farm', 'f', { name: 'New' })).toMatchObject({ name: 'New', variety: 'x' });
  });

  it('soft-deletes by stamping deletedAt', async () => {
    const { service, fields } = build([{ id: 'f', farmId: 'farm' } as FieldEntity]);
    await service.remove('farm', 'f');
    expect(fields.update).toHaveBeenCalledWith({ id: 'f' }, { deletedAt: expect.any(Date) });
  });

  it('throws not found for an unknown field', async () => {
    await expect(build().service.get('farm', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
