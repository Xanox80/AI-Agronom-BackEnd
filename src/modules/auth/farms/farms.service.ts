import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FarmEntity } from '../../../domain/entities';
import { FarmDto } from '../../../domain/types';
import { UpdateFarmDto } from '../dto/farm-audit.dto';
import { stripUndefined } from '../strip-undefined';
import { toFarmDto } from '../users/user.mapper';

@Injectable()
export class FarmsService {
  constructor(@InjectRepository(FarmEntity) private readonly farms: Repository<FarmEntity>) {}

  async get(farmId: string): Promise<FarmDto> {
    return toFarmDto(await this.require(farmId));
  }

  async update(farmId: string, dto: UpdateFarmDto): Promise<FarmDto> {
    const farm = await this.require(farmId);
    const { name, regionCode, timezone, defaultSafetyBuffers } = dto;
    Object.assign(farm, stripUndefined({ name, regionCode, timezone, defaultSafetyBuffers }));
    return toFarmDto(await this.farms.save(farm));
  }

  private async require(farmId: string): Promise<FarmEntity> {
    const farm = await this.farms.findOneBy({ id: farmId });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }
}
