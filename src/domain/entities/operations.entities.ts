import { Column, Entity, Index } from 'typeorm';
import { StockSource, SyncOperation, SyncStatus, TaskPriority, TaskStatus, TaskType } from '../enums';
import { BaseEntity, OfflineEntity, TenantEntity } from './base.entity';
import type { ResistanceGroupUse } from '../types';

@Entity('tasks')
export class TaskEntity extends OfflineEntity {
  @Column({ type: 'varchar' }) type: TaskType;
  @Column({ type: 'varchar', length: 36 }) fieldId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) observationId: string | null;
  @Column({ type: 'float', nullable: true }) lat: number | null;
  @Column({ type: 'float', nullable: true }) lng: number | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) diagnosisId: string | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) recommendationId: string | null;
  @Column({ type: 'simple-json' }) photoIds: string[];
  @Column({ type: 'varchar', default: TaskPriority.Normal }) priority: TaskPriority;
  @Column({ type: 'varchar', length: 36, nullable: true }) assigneeUserId: string | null;
  @Column({ type: 'varchar', length: 36 }) createdByUserId: string;
  @Column({ type: 'datetime', nullable: true }) deadline: Date | null;
  @Column({ type: 'varchar', default: TaskStatus.Open }) status: TaskStatus;
  @Column() title: string;
  @Column({ type: 'text', default: '' }) notes: string;
  @Column({ type: 'datetime', nullable: true }) completedAt: Date | null;
}

@Entity('treatment_log')
export class TreatmentEntity extends OfflineEntity {
  @Column({ type: 'varchar', length: 36 }) fieldId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) taskId: string | null;
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'simple-json' }) activeSubstanceCodes: string[];
  @Column({ type: 'simple-json' }) resistanceGroups: ResistanceGroupUse[];
  @Column({ type: 'float' }) doseValue: number;
  @Column() doseUnit: string;
  @Column({ type: 'float' }) treatedAreaHa: number;
  @Column({ type: 'date' }) appliedAt: string;
  @Column({ type: 'varchar', length: 36 }) recordedByUserId: string;
}

@Entity('stock_items')
@Index(['farmId', 'productId', 'warehouse', 'lotNumber'], { unique: true })
export class StockItemEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'float' }) quantity: number;
  @Column() unit: string;
  @Column({ type: 'varchar', nullable: true }) warehouse: string | null;
  @Column({ type: 'varchar', nullable: true }) lotNumber: string | null;
  @Column({ type: 'date', nullable: true }) expiresAt: string | null;
  @Column({ type: 'varchar', default: StockSource.Manual }) source: StockSource;
  @Column({ type: 'datetime', nullable: true }) syncedAt: Date | null;
}

/** Append-only: createdAt is the event time and the row is never updated. */
@Entity('audit_log')
export class AuditLogEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36, nullable: true }) farmId: string | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) userId: string | null;
  @Column() action: string;
  @Column() entityType: string;
  @Column() entityId: string;
  @Column({ type: 'varchar', nullable: true }) ip: string | null;
  @Column({ type: 'simple-json' }) meta: Record<string, unknown>;
}

@Entity('sync_records')
@Index(['deviceId', 'entityType', 'clientId'], { unique: true })
export class SyncRecordEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column() deviceId: string;
  @Column() entityType: string;
  @Column({ type: 'varchar', length: 36 }) clientId: string;
  @Column({ type: 'varchar', length: 36 }) serverId: string;
  @Column({ type: 'varchar' }) operation: SyncOperation;
  @Column({ type: 'varchar' }) status: SyncStatus;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'datetime' }) clientTimestamp: Date;
  @Column({ type: 'datetime' }) appliedAt: Date;
}
