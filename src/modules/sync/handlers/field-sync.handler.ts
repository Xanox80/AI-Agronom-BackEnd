import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { FieldEntity } from '../../../domain/entities';
import { FieldSource, Role, SyncEntityType } from '../../../domain/enums';
import { FieldGeometryService } from '../../fields/field-geometry.service';
import { FieldPayloadDto } from '../dto/payloads.dto';
import { SyncChange, SyncContext, dateOnly, optionalDate } from './entity-sync-handler';
import { OfflineRowHandler } from './offline-row.handler';

@Injectable()
export class FieldSyncHandler extends OfflineRowHandler<FieldEntity, FieldPayloadDto> {
  readonly entityType = SyncEntityType.Field;
  readonly roles = [Role.Scout, Role.ChiefAgronomist];
  protected readonly payloadClass = FieldPayloadDto;

  constructor(@InjectRepository(FieldEntity) repo: Repository<FieldEntity>, private readonly geometry: FieldGeometryService) {
    super(repo);
  }

  protected build(ctx: SyncContext, change: SyncChange, p: FieldPayloadDto): DeepPartial<FieldEntity> {
    const shape = p.contour ? this.geometry.describe(p.contour) : null;
    return {
      id: change.clientId, clientId: change.clientId, farmId: ctx.farmId, name: p.name, areaHa: shape?.areaHa ?? p.areaHa ?? 0,
      cropId: p.cropId ?? null, variety: p.variety ?? null, sowingDate: p.sowingDate ? dateOnly(p.sowingDate) : null,
      contour: shape?.contour ?? null, bbox: shape?.bbox ?? null, centroidLat: shape?.centroid.lat ?? null,
      centroidLng: shape?.centroid.lng ?? null, source: p.source ?? FieldSource.Manual,
      nearWater: p.nearWater ?? false, nearApiary: p.nearApiary ?? false, nearSettlement: p.nearSettlement ?? false,
      clientCreatedAt: optionalDate(p.clientCreatedAt) ?? change.clientTimestamp,
    };
  }

  protected edit(row: FieldEntity, p: FieldPayloadDto): void {
    row.name = p.name;
    this.applyContour(row, p);
    row.cropId = p.cropId ?? row.cropId;
    row.variety = p.variety ?? row.variety;
    row.nearWater = p.nearWater ?? row.nearWater;
    row.nearApiary = p.nearApiary ?? row.nearApiary;
    row.nearSettlement = p.nearSettlement ?? row.nearSettlement;
  }

  private applyContour(row: FieldEntity, p: FieldPayloadDto): void {
    if (!p.contour) return;
    const shape = this.geometry.describe(p.contour);
    Object.assign(row, { contour: shape.contour, bbox: shape.bbox, areaHa: shape.areaHa, centroidLat: shape.centroid.lat, centroidLng: shape.centroid.lng });
  }

  protected async deleteRow(row: FieldEntity): Promise<void> {
    row.deletedAt = new Date();
    await this.repo.save(row);
  }
}
