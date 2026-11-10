import { Column, Entity, Index } from 'typeorm';
import { DiagnosisPass, Organ, PestStage, ProblemCategory } from '../enums';
import { BaseEntity, TenantEntity } from './base.entity';
import type { QuestionDto } from '../types';

@Entity('diagnosis_results')
@Index(['observationId', 'pass'], { unique: true })
export class DiagnosisResultEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column({ type: 'varchar' }) pass: DiagnosisPass;
  @Column() providerName: string;
  @Column() modelVersion: string;
  @Column({ type: 'varchar', nullable: true }) cropCode: string | null;
  @Column({ type: 'varchar', nullable: true }) organ: Organ | null;
  @Column({ type: 'varchar', nullable: true }) problemCategory: ProblemCategory | null;
  @Column({ type: 'float' }) calibrationTemperature: number;
  @Column({ type: 'float' }) entropy: number;
  @Column({ type: 'boolean', default: false }) unsure: boolean;
  @Column({ type: 'varchar', nullable: true }) unsureReason: string | null;
  @Column({ type: 'boolean', default: false }) outOfDistribution: boolean;
  @Column({ type: 'varchar', nullable: true }) pestSpecies: string | null;
  @Column({ type: 'varchar', nullable: true }) pestStage: PestStage | null;
  @Column({ type: 'float', nullable: true }) pestDensityPerPlant: number | null;
  @Column({ type: 'float', nullable: true }) pestDensityPerM2: number | null;
  @Column({ type: 'simple-json' }) clarifyingQuestions: QuestionDto[];
  @Column({ type: 'simple-json' }) answers: Record<string, string>;
  @Column({ type: 'simple-json' }) rawResponse: Record<string, unknown>;
  @Column({ type: 'int', default: 0 }) latencyMs: number;
}

@Entity('diagnosis_hypotheses')
export class DiagnosisHypothesisEntity extends BaseEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) diagnosisResultId: string;
  @Column({ type: 'int' }) rank: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) diagnosisId: string | null;
  @Column() diagnosisCode: string;
  @Column({ type: 'float' }) rawProbability: number;
  @Column({ type: 'float' }) probability: number;
  @Column({ type: 'varchar', nullable: true }) stage: string | null;
  @Column({ type: 'text', default: '' }) evidence: string;
  @Column({ type: 'float', nullable: true }) regionX: number | null;
  @Column({ type: 'float', nullable: true }) regionY: number | null;
  @Column({ type: 'float', nullable: true }) regionW: number | null;
  @Column({ type: 'float', nullable: true }) regionH: number | null;
  @Column({ type: 'int', nullable: true }) regionPhotoSeq: number | null;
}
