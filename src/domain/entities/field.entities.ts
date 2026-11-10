import { Column, Entity, Index } from 'typeorm';
import type { Geometry } from 'geojson';
import { FieldSource } from '../enums';
import { OfflineEntity, TenantEntity } from './base.entity';

@Entity('fields')
export class FieldEntity extends OfflineEntity {
  @Column() name: string;
  @Column({ type: 'float', default: 0 }) areaHa: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) cropId: string | null;
  @Column({ type: 'varchar', nullable: true }) variety: string | null;
  @Column({ type: 'date', nullable: true }) sowingDate: string | null;
  @Column({ type: 'simple-json', nullable: true }) contour: Geometry | null;
  @Column({ type: 'simple-json', nullable: true }) bbox: [number, number, number, number] | null;
  @Column({ type: 'float', nullable: true }) centroidLat: number | null;
  @Column({ type: 'float', nullable: true }) centroidLng: number | null;
  @Column({ type: 'varchar', default: FieldSource.Manual }) source: FieldSource;
  @Column({ type: 'boolean', default: false }) nearWater: boolean;
  @Column({ type: 'boolean', default: false }) nearApiary: boolean;
  @Column({ type: 'boolean', default: false }) nearSettlement: boolean;
  @Column({ type: 'datetime', nullable: true }) deletedAt: Date | null;
}

@Entity('field_crop_memory')
@Index(['userId', 'fieldId'], { unique: true })
export class FieldCropMemoryEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'varchar', length: 36 }) fieldId: string;
  @Column({ type: 'varchar', length: 36 }) cropId: string;
  @Column({ type: 'datetime' }) lastUsedAt: Date;
}
