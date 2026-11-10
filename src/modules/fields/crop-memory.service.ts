import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldCropMemoryEntity, FieldEntity } from '../../domain/entities';

/** Remembers, per user and field, the crop chosen last (scenario step 1); callers pass an already farm-checked field. */
@Injectable()
export class CropMemoryService {
  constructor(@InjectRepository(FieldCropMemoryEntity) private readonly memory: Repository<FieldCropMemoryEntity>) {}

  async recall(userId: string, field: FieldEntity): Promise<{ cropId?: string }> {
    const entry = await this.memory.findOneBy({ userId, fieldId: field.id });
    return { cropId: entry?.cropId };
  }

  async remember(userId: string, field: Pick<FieldEntity, 'id' | 'farmId'>, cropId: string): Promise<void> {
    const entry = (await this.memory.findOneBy({ userId, fieldId: field.id })) ?? this.memory.create({ farmId: field.farmId, userId, fieldId: field.id });
    entry.cropId = cropId;
    entry.lastUsedAt = new Date();
    await this.memory.save(entry);
  }
}
