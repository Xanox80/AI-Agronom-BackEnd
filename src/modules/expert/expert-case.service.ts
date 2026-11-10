import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExpertCaseReason, ExpertCaseStatus } from '../../domain/enums';
import { DiagnosisHypothesisEntity, DiagnosisResultEntity, ExpertCaseEntity } from '../../domain/entities';
import { CasePriorityService } from './case-priority.service';
import { DiagnosisSignals, reasonFor } from './case-reason.rules';
import { EXPERT_CONFIG, ExpertConfig } from './expert.config';
import { RareClassService } from './rare-class.service';

const UNRESOLVED = [ExpertCaseStatus.Open, ExpertCaseStatus.InReview];

@Injectable()
export class ExpertCaseService {
  constructor(
    @InjectRepository(ExpertCaseEntity) private readonly cases: Repository<ExpertCaseEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    private readonly priority: CasePriorityService,
    private readonly rareClasses: RareClassService,
    @Inject(EXPERT_CONFIG) private readonly config: ExpertConfig,
  ) {}

  findUnresolved(observationId: string): Promise<ExpertCaseEntity | null> {
    return this.cases.findOne({ where: { observationId, status: In(UNRESOLVED) } });
  }

  async getOrFail(id: string): Promise<ExpertCaseEntity> {
    const found = await this.cases.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Expert case not found');
    return found;
  }

  /** Opens a case for a fresh diagnosis when it is low confidence, unsure, out of distribution or rare. */
  async openForDiagnosis(diagnosisResultId: string): Promise<ExpertCaseEntity | null> {
    const result = await this.results.findOne({ where: { id: diagnosisResultId } });
    if (!result) return null;
    const signals = await this.signalsOf(result);
    const reason = reasonFor(signals, this.config.lowConfidenceThreshold);
    return reason ? this.open(result, reason, signals) : null;
  }

  async openForDisagreement(observationId: string): Promise<ExpertCaseEntity | null> {
    const result = await this.results.findOne({ where: { observationId }, order: { createdAt: 'DESC' } });
    if (!result) return null;
    return this.open(result, ExpertCaseReason.UserModelDisagreement, await this.signalsOf(result));
  }

  private async signalsOf(result: DiagnosisResultEntity): Promise<DiagnosisSignals> {
    const top = await this.hypotheses.findOne({ where: { diagnosisResultId: result.id }, order: { rank: 'ASC' } });
    return {
      outOfDistribution: result.outOfDistribution, unsure: result.unsure,
      topProbability: top?.probability ?? 0, rare: await this.rareClasses.isRare(top?.diagnosisId ?? null),
    };
  }

  private async open(result: DiagnosisResultEntity, reason: ExpertCaseReason, signals: DiagnosisSignals): Promise<ExpertCaseEntity> {
    const existing = await this.findUnresolved(result.observationId);
    if (existing) return existing;
    const priority = this.priority.priorityOf(reason, signals.topProbability, signals.rare);
    return this.cases.save(this.cases.create({
      farmId: result.farmId, observationId: result.observationId, diagnosisResultId: result.id,
      reason, status: ExpertCaseStatus.Open, priority, assignedExpertId: null, resolvedAt: null,
    }));
  }
}
