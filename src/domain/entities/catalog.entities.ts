import { Column, Entity, Index, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm';
import {
  ProblemCategory, ProposalEntityType, ProposalOperation, ProposalStatus,
  RateUnit, ResistanceSystem, PollinatorHazard, ThresholdMetric,
} from '../enums';
import { BaseEntity, CatalogEntity } from './base.entity';
import type { QuestionDto } from '../types';

@Entity('crops')
export class CropEntity extends CatalogEntity {
  @Column({ unique: true }) code: string;
  @Column() nameUk: string;
  @Column() nameEn: string;
}

@Entity('bbch_stages')
export class BbchStageEntity extends CatalogEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) cropId: string;
  @Column({ type: 'int' }) bbchFrom: number;
  @Column({ type: 'int' }) bbchTo: number;
  @Column() nameUk: string;
  @Column() nameEn: string;
  @Column() phase: string;
}

@Entity('catalog_diagnoses')
export class CatalogDiagnosisEntity extends CatalogEntity {
  @Column({ unique: true }) code: string;
  @Column() nameUk: string;
  @Column() nameEn: string;
  @Column({ type: 'varchar', nullable: true }) latinName: string | null;
  @Column({ type: 'varchar' }) problemCategory: ProblemCategory;
  @Column({ type: 'boolean', default: false }) isQuarantine: boolean;
  @Column({ type: 'boolean', default: false }) isCritical: boolean;
  @Column({ type: 'simple-json' }) typicalOrgans: string[];
  @Column({ type: 'text', default: '' }) descriptionUk: string;
  @Column({ type: 'text', default: '' }) descriptionEn: string;
  @Column({ type: 'simple-json' }) clarifyingQuestions: QuestionDto[];
  @ManyToMany(() => CropEntity)
  @JoinTable({ name: 'diagnosis_crops' })
  crops: CropEntity[];
}

@Entity('thresholds')
export class ThresholdEntity extends CatalogEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) diagnosisId: string;
  @Column({ type: 'varchar', length: 36 }) cropId: string;
  @Column({ type: 'int' }) bbchFrom: number;
  @Column({ type: 'int' }) bbchTo: number;
  @Column({ type: 'varchar' }) metric: ThresholdMetric;
  @Column({ type: 'float' }) thresholdValue: number;
  @Column({ type: 'float', nullable: true }) urgentValue: number | null;
  @Column() unit: string;
}

@Entity('active_substances')
export class ActiveSubstanceEntity extends CatalogEntity {
  @Column({ unique: true }) code: string;
  @Column() nameUk: string;
  @Column() nameEn: string;
  @Column({ type: 'varchar', default: ResistanceSystem.None }) resistanceSystem: ResistanceSystem;
  @Column({ type: 'varchar', default: '' }) resistanceGroup: string;
  @Column({ type: 'int', nullable: true }) maxApplicationsPerSeason: number | null;
}

@Entity('products')
export class ProductEntity extends CatalogEntity {
  @Column({ type: 'varchar', nullable: true }) registrationNumber: string | null;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) formulation: string | null;
  @Column({ type: 'varchar', nullable: true }) registrant: string | null;
  @Column({ type: 'varchar', default: PollinatorHazard.Unknown }) pollinatorHazard: PollinatorHazard;
  @Column({ type: 'int', default: 0 }) waterProtectionZoneM: number;
  @Column({ type: 'int', default: 0 }) apiaryZoneM: number;
  @Column({ type: 'int', default: 0 }) settlementZoneM: number;
  @Column({ type: 'float', nullable: true }) pricePerHaUah: number | null;
  @Column({ type: 'text', nullable: true }) efficacyNote: string | null;
}

@Entity('product_active_substances')
export class ProductActiveSubstanceEntity extends BaseEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'varchar', length: 36 }) activeSubstanceId: string;
  @Column({ type: 'varchar', default: '' }) concentration: string;
}

@Entity('product_registrations')
export class ProductRegistrationEntity extends CatalogEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'varchar', length: 36 }) cropId: string;
  @Column({ type: 'varchar', length: 36 }) diagnosisId: string;
  @Column({ type: 'float' }) rateMin: number;
  @Column({ type: 'float' }) rateMax: number;
  @Column({ type: 'varchar' }) rateUnit: RateUnit;
  @Column({ type: 'int' }) maxApplications: number;
  @Column({ type: 'int' }) minIntervalDays: number;
  @Column({ type: 'int' }) preHarvestIntervalDays: number;
  @Column({ type: 'int' }) bbchFrom: number;
  @Column({ type: 'int' }) bbchTo: number;
  @Column({ type: 'float' }) efficacyScore: number;
  @Column({ type: 'simple-json' }) incompatibleWith: string[];
  @Column({ type: 'float', nullable: true }) maxWindSpeedMs: number | null;
  @Column({ type: 'float', nullable: true }) minTempC: number | null;
  @Column({ type: 'float', nullable: true }) maxTempC: number | null;
}

@Entity('reference_images')
export class ReferenceImageEntity extends CatalogEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) diagnosisId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) cropId: string | null;
  @Column({ type: 'varchar', nullable: true }) stage: string | null;
  @Column() storageKey: string;
  @Column({ type: 'varchar', default: '' }) caption: string;
  @Column({ type: 'varchar', default: '' }) attribution: string;
}

@Entity('catalog_change_proposals')
export class CatalogChangeProposalEntity extends BaseEntity {
  @Column({ type: 'varchar' }) entityType: ProposalEntityType;
  @Column({ type: 'varchar', length: 36, nullable: true }) entityId: string | null;
  @Column({ type: 'varchar' }) operation: ProposalOperation;
  @Column({ type: 'simple-json' }) payload: Record<string, unknown>;
  @Column({ type: 'varchar', default: ProposalStatus.Pending }) status: ProposalStatus;
  @Column({ type: 'varchar', length: 36 }) proposedByUserId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) reviewedByUserId: string | null;
  @Column({ type: 'datetime', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'text', nullable: true }) reviewComment: string | null;
}

@Entity('catalog_state')
export class CatalogStateEntity {
  @PrimaryColumn() regionCode: string;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'datetime' }) publishedAt: Date;
  @Column({ type: 'datetime' }) lastVerifiedAt: Date;
}
