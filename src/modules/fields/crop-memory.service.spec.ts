import { Repository } from 'typeorm';
import { FieldCropMemoryEntity, FieldEntity } from '../../domain/entities';
import { CropMemoryService } from './crop-memory.service';

const field = { id: 'f', farmId: 'farm' } as FieldEntity;

function build() {
  const rows: FieldCropMemoryEntity[] = [];
  const repo = {
    findOneBy: async ({ userId, fieldId }: Partial<FieldCropMemoryEntity>) => rows.find((r) => r.userId === userId && r.fieldId === fieldId) ?? null,
    create: (partial: Partial<FieldCropMemoryEntity>) => ({ ...partial }) as FieldCropMemoryEntity,
    save: async (entry: FieldCropMemoryEntity) => {
      if (!rows.includes(entry)) rows.push(entry);
      return entry;
    },
  };
  return { service: new CropMemoryService(repo as unknown as Repository<FieldCropMemoryEntity>), rows };
}

describe('CropMemoryService', () => {
  it('recalls nothing before a crop was chosen', async () => {
    expect(await build().service.recall('u', field)).toEqual({ cropId: undefined });
  });

  it('remembers the last crop per user and field, overwriting the previous one', async () => {
    const { service, rows } = build();
    await service.remember('u', field, 'wheat');
    await service.remember('u', field, 'maize');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ farmId: 'farm', fieldId: 'f' });
    expect(await service.recall('u', field)).toEqual({ cropId: 'maize' });
    expect(await service.recall('other', field)).toEqual({ cropId: undefined });
  });
});
