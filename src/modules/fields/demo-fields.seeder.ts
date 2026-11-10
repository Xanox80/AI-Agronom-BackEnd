import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEMO_FARM_SEEDED, DemoFarmSeededEvent } from '../../domain/demo-events';
import { CropEntity } from '../../domain/entities';
import { DEMO_FIELDS } from './demo-fields.data';
import { FieldsService } from './fields.service';

/** Gives a freshly seeded demo farm three fields with contours. */
@Injectable()
export class DemoFieldsSeeder {
  constructor(
    private readonly fields: FieldsService,
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
  ) {}

  @OnEvent(DEMO_FARM_SEEDED)
  async seed({ farmId }: DemoFarmSeededEvent): Promise<void> {
    for (const { cropCode, ...field } of DEMO_FIELDS) {
      const crop = await this.crops.findOneBy({ code: cropCode });
      await this.fields.create(farmId, { ...field, cropId: crop?.id });
    }
  }
}
