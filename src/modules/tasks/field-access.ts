import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldEntity } from '../../domain/entities';

/** Guards task and treatment writes against fields of another farm. */
@Injectable()
export class FieldAccess {
  constructor(@InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>) {}

  async require(farmId: string, fieldId: string): Promise<void> {
    if (!(await this.fields.exist({ where: { id: fieldId, farmId } }))) throw new NotFoundException('Field not found');
  }
}
