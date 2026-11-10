import { Column, Entity, Index } from 'typeorm';
import { ActionLevel, ProblemCategory, RecommendationStatus, WeatherVerdict } from '../enums';
import { BaseEntity, TenantEntity } from './base.entity';
import type { RecommendationSource, SafetyWarning } from '../types';

@Entity('recommendations')
export class RecommendationEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column({ type: 'varchar', length: 36 }) diagnosisResultId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) confirmedDiagnosisId: string | null;
  @Column({ type: 'varchar', default: RecommendationStatus.Draft }) status: RecommendationStatus;
  @Column({ type: 'varchar' }) actionLevel: ActionLevel;
  @Column({ type: 'boolean', nullable: true }) thresholdExceeded: boolean | null;
  @Column({ type: 'varchar', nullable: true }) weatherVerdict: WeatherVerdict | null;
  @Column({ type: 'text', nullable: true }) weatherReason: string | null;
  @Column({ type: 'simple-json' }) weatherForecast: Record<string, unknown>;
  @Column({ type: 'simple-json' }) safetyWarnings: SafetyWarning[];
  @Column({ type: 'text', default: '' }) explanation: string;
  @Column({ type: 'simple-json' }) sources: RecommendationSource[];
  @Column({ type: 'int' }) catalogVersion: number;
  @Column({ type: 'boolean', default: false }) catalogStale: boolean;
  @Column({ type: 'boolean', default: false }) autoApproved: boolean;
  @Column({ type: 'varchar', length: 36, nullable: true }) approvedByUserId: string | null;
  @Column({ type: 'datetime', nullable: true }) approvedAt: Date | null;
  @Column({ type: 'text', nullable: true }) rejectionReason: string | null;
}

@Entity('recommendation_items')
export class RecommendationItemEntity extends BaseEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) recommendationId: string;
  @Column({ type: 'int' }) rank: number;
  @Column({ type: 'varchar', length: 36 }) productRegistrationId: string;
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'simple-json' }) activeSubstanceCodes: string[];
  @Column({ type: 'float' }) rateValue: number;
  @Column() rateUnit: string;
  @Column({ type: 'text', default: '' }) applicationTiming: string;
  @Column({ type: 'int' }) bbchFrom: number;
  @Column({ type: 'int' }) bbchTo: number;
  @Column({ type: 'int' }) preHarvestIntervalDays: number;
  @Column({ type: 'varchar', nullable: true }) resistanceSystem: string | null;
  @Column({ type: 'varchar', nullable: true }) resistanceGroup: string | null;
  @Column({ type: 'boolean', default: true }) rotationOk: boolean;
  @Column({ type: 'text', nullable: true }) rotationNote: string | null;
  @Column({ type: 'float', nullable: true }) stockQty: number | null;
  @Column({ type: 'varchar', nullable: true }) stockUnit: string | null;
  @Column({ type: 'boolean', default: false }) inStock: boolean;
  @Column({ type: 'float', nullable: true }) costPerHaUah: number | null;
  @Column({ type: 'boolean', default: false }) excluded: boolean;
  @Column({ type: 'text', nullable: true }) excludedReason: string | null;
  @Column({ type: 'float', default: 0 }) score: number;
}

@Entity('auto_approve_settings')
@Index(['farmId', 'problemCategory', 'diagnosisId'], { unique: true })
export class AutoApproveSettingEntity extends TenantEntity {
  @Column({ type: 'varchar', nullable: true }) problemCategory: ProblemCategory | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) diagnosisId: string | null;
  @Column({ type: 'float' }) minConfidence: number;
  @Column({ type: 'boolean', default: false }) enabled: boolean;
  @Column({ type: 'varchar', length: 36 }) enabledByUserId: string;
}
