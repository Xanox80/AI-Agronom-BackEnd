import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Like, Repository } from 'typeorm';
import { CropEntity, FieldEntity } from '../../domain/entities';
import { FieldSource } from '../../domain/enums';
import type { FieldDto, Page } from '../../domain/types';
import { CreateFieldDto, ListFieldsQueryDto, UpdateFieldDto } from './dto/field.dto';
import { CropMemoryService } from './crop-memory.service';
import { FieldGeometryService } from './field-geometry.service';
import { FieldsSettings } from './fields.settings';

@Injectable()
export class FieldsService {
  constructor(
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    private readonly geometry: FieldGeometryService,
    private readonly cropMemory: CropMemoryService,
    private readonly settings: FieldsSettings,
  ) {}

  async list(farmId: string, query: ListFieldsQueryDto): Promise<Page<FieldDto>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? this.settings.defaultPageSize, this.settings.maxPageSize);
    const where: FindOptionsWhere<FieldEntity> = { farmId, deletedAt: IsNull() };
    if (query.cropId) where.cropId = query.cropId;
    if (query.q) where.name = Like(`%${query.q}%`);
    const [rows, total] = await this.fields.findAndCount({ where, order: { name: 'ASC' }, skip: (page - 1) * pageSize, take: pageSize });
    return { items: await this.toDtos(rows), total, page, pageSize };
  }

  async get(farmId: string, id: string): Promise<FieldDto> {
    return (await this.toDtos([await this.findEntity(farmId, id)]))[0];
  }

  async create(farmId: string, input: CreateFieldDto, userId?: string): Promise<FieldDto> {
    const existing = input.clientId ? await this.fields.findOneBy({ clientId: input.clientId }) : null;
    if (existing) return this.replay(existing, farmId);
    const entity = this.fields.create({ farmId, clientId: input.clientId, source: FieldSource.Manual, clientCreatedAt: null });
    entity.clientId ??= randomUUID();
    entity.id = entity.clientId;
    return this.save(entity, input, userId);
  }

  async update(farmId: string, id: string, input: UpdateFieldDto, userId?: string): Promise<FieldDto> {
    return this.save(await this.findEntity(farmId, id), input, userId);
  }

  async remove(farmId: string, id: string): Promise<void> {
    const entity = await this.findEntity(farmId, id);
    await this.fields.update({ id: entity.id }, { deletedAt: new Date() });
  }

  async recallCrop(farmId: string, userId: string, id: string): Promise<{ cropId?: string }> {
    return this.cropMemory.recall(userId, await this.findEntity(farmId, id));
  }

  async rememberCrop(farmId: string, userId: string, id: string, cropId: string): Promise<void> {
    const entity = await this.findEntity(farmId, id);
    await this.assertCropExists(cropId);
    await this.cropMemory.remember(userId, entity, cropId);
  }

  async findEntity(farmId: string, id: string): Promise<FieldEntity> {
    const entity = await this.fields.findOneBy({ id, farmId, deletedAt: IsNull() });
    if (!entity) throw new NotFoundException({ code: 'FIELD_NOT_FOUND', message: ['field not found'] });
    return entity;
  }

  async toDtos(entities: FieldEntity[]): Promise<FieldDto[]> {
    const cropCodes = await this.cropCodes(entities);
    return entities.map((entity) => toFieldDto(entity, entity.cropId ? cropCodes.get(entity.cropId) : undefined));
  }

  private async replay(existing: FieldEntity, farmId: string): Promise<FieldDto> {
    if (existing.farmId !== farmId) {
      throw new ConflictException({ code: 'FIELD_CLIENT_ID_TAKEN', message: ['clientId is already in use'] });
    }
    if (existing.deletedAt) throw new ConflictException({ code: 'FIELD_DELETED', message: ['field was deleted'] });
    return (await this.toDtos([existing]))[0];
  }

  private async save(entity: FieldEntity, input: UpdateFieldDto, userId?: string): Promise<FieldDto> {
    const { contour, clientId, ...plain } = input;
    this.assertTextLengths(plain);
    if (plain.cropId) await this.assertCropExists(plain.cropId);
    Object.assign(entity, withoutUndefined(plain));
    if (contour) this.applyShape(entity, contour);
    await this.fields.save(entity);
    if (userId && plain.cropId) await this.cropMemory.remember(userId, entity, plain.cropId);
    return (await this.toDtos([entity]))[0];
  }

  private assertTextLengths({ name, variety }: UpdateFieldDto): void {
    const limit = this.settings.nameMaxLength;
    if ((name?.length ?? 0) > limit || (variety?.length ?? 0) > limit) {
      throw new BadRequestException({ code: 'FIELD_TEXT_TOO_LONG', message: [`name and variety must be at most ${limit} characters`] });
    }
  }

  private async assertCropExists(cropId: string): Promise<void> {
    if (!(await this.crops.findOneBy({ id: cropId }))) {
      throw new BadRequestException({ code: 'CROP_NOT_FOUND', message: ['cropId does not exist in the crops catalogue'] });
    }
  }

  private applyShape(entity: FieldEntity, contour: unknown): void {
    const shape = this.geometry.describe(contour);
    Object.assign(entity, {
      contour: shape.contour, bbox: shape.bbox, areaHa: shape.areaHa,
      centroidLat: shape.centroid.lat, centroidLng: shape.centroid.lng,
    });
  }

  private async cropCodes(entities: FieldEntity[]): Promise<Map<string, string>> {
    if (!entities.some((entity) => entity.cropId)) return new Map();
    const crops = await this.crops.find();
    return new Map(crops.map((crop) => [crop.id, crop.code]));
  }
}

export function toFieldDto(entity: FieldEntity, cropCode?: string): FieldDto {
  return {
    id: entity.id,
    clientId: entity.clientId,
    name: entity.name,
    areaHa: entity.areaHa,
    cropId: entity.cropId ?? undefined,
    cropCode,
    variety: entity.variety ?? undefined,
    sowingDate: entity.sowingDate ?? undefined,
    contour: entity.contour ?? undefined,
    centroid: entity.centroidLat == null || entity.centroidLng == null ? undefined : { lat: entity.centroidLat, lng: entity.centroidLng },
    source: entity.source,
    nearWater: entity.nearWater,
    nearApiary: entity.nearApiary,
    nearSettlement: entity.nearSettlement,
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
