import { Column, Entity } from 'typeorm';
import { ExpertCaseReason, ExpertCaseStatus, LabelAction, LabelSource } from '../enums';
import { BaseEntity, TenantEntity } from './base.entity';
import type { AffectedRegion } from '../types';

@Entity('expert_cases')
export class ExpertCaseEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column({ type: 'varchar', length: 36 }) diagnosisResultId: string;
  @Column({ type: 'varchar' }) reason: ExpertCaseReason;
  @Column({ type: 'varchar', default: ExpertCaseStatus.Open }) status: ExpertCaseStatus;
  @Column({ type: 'int', default: 0 }) priority: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) assignedExpertId: string | null;
  @Column({ type: 'datetime', nullable: true }) resolvedAt: Date | null;
}

@Entity('labels')
export class LabelEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36, nullable: true }) expertCaseId: string | null;
  @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) photoId: string | null;
  @Column({ type: 'varchar', length: 36 }) labelerUserId: string;
  @Column({ type: 'varchar' }) labelSource: LabelSource;
  @Column({ type: 'varchar', length: 36, nullable: true }) diagnosisId: string | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) newClassProposalId: string | null;
  @Column({ type: 'simple-json', nullable: true }) affectedRegion: AffectedRegion | null;
  @Column({ type: 'float' }) weight: number;
  @Column({ type: 'varchar' }) action: LabelAction;
  @Column({ type: 'text', nullable: true }) comment: string | null;
  @Column({ type: 'boolean', default: false }) inDataset: boolean;
}
