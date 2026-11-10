import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { ExpertCaseStatus, LabelAction, LabelSource, ProposalEntityType, ProposalOperation } from '../../domain/enums';
import {
  CatalogChangeProposalEntity, DiagnosisHypothesisEntity, ExpertCaseEntity, LabelEntity, UserEntity,
} from '../../domain/entities';
import { computeConsensus } from './consensus';
import { CreateLabelDto } from './dto/label.dto';
import { ExpertCaseService } from './expert-case.service';
import { LABEL_ACTION_STRATEGIES } from './label-action.strategies';
import { LabelWeightService } from './label-weight.service';
import { assertValidRegion } from './region';

@Injectable()
export class LabelingService {
  constructor(
    @InjectRepository(ExpertCaseEntity) private readonly cases: Repository<ExpertCaseEntity>,
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    @InjectRepository(CatalogChangeProposalEntity) private readonly proposals: Repository<CatalogChangeProposalEntity>,
    private readonly caseService: ExpertCaseService,
    private readonly weights: LabelWeightService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async claim(caseId: string, expertId: string): Promise<ExpertCaseEntity> {
    return this.claimOpenCase(await this.openCase(caseId), expertId);
  }

  /** One label per labeler and case; labelling claims an unclaimed case. Reaching consensus resolves the case. */
  async addLabel(caseId: string, labelerId: string, dto: CreateLabelDto): Promise<LabelEntity> {
    const expertCase = await this.claimOpenCase(await this.openCase(caseId), labelerId);
    if (dto.affectedRegion) assertValidRegion(dto.affectedRegion);
    const labeler = await this.users.findOneByOrFail({ id: labelerId });
    const top = await this.hypotheses.findOne({ where: { diagnosisResultId: expertCase.diagnosisResultId }, order: { rank: 'ASC' } });
    const target = LABEL_ACTION_STRATEGIES[dto.action]({ dto, modelTopDiagnosisId: top?.diagnosisId ?? null });
    const proposal = target.proposeNewClass ? await this.proposeNewClass(dto, labelerId) : null;
    const existing = await this.labels.findOne({ where: { expertCaseId: caseId, labelerUserId: labelerId } });

    const label = await this.saveOrDropProposal(this.labels.create({
      ...existing,
      expertCaseId: caseId, observationId: expertCase.observationId, labelerUserId: labelerId,
      labelSource: this.weights.sourceFor(labeler.role), diagnosisId: target.diagnosisId, newClassProposalId: proposal?.id ?? null,
      affectedRegion: dto.affectedRegion ?? null, weight: this.weights.weightFor(labeler), action: dto.action, comment: dto.comment ?? null,
    }), proposal);
    await this.resolveOnConsensus(expertCase);
    return label;
  }

  async resolve(caseId: string, expertId: string, finalDiagnosisId: string): Promise<ExpertCaseEntity> {
    const expertCase = await this.claimOpenCase(await this.openCase(caseId), expertId);
    return this.finish(expertCase, finalDiagnosisId);
  }

  private async claimOpenCase(expertCase: ExpertCaseEntity, expertId: string): Promise<ExpertCaseEntity> {
    if (expertCase.assignedExpertId === expertId) return expertCase;
    if (expertCase.assignedExpertId) throw new ForbiddenException('Case is claimed by another expert');
    return this.cases.save({ ...expertCase, status: ExpertCaseStatus.InReview, assignedExpertId: expertId });
  }

  private async saveOrDropProposal(label: LabelEntity, proposal: CatalogChangeProposalEntity | null): Promise<LabelEntity> {
    try {
      return await this.labels.save(label);
    } catch (error) {
      if (proposal) await this.proposals.delete(proposal.id);
      throw error;
    }
  }

  private async resolveOnConsensus(expertCase: ExpertCaseEntity): Promise<void> {
    const consensus = await this.reachedConsensus(expertCase.id);
    const hasExpertVote = await this.labels.exist({ where: { expertCaseId: expertCase.id, labelSource: LabelSource.Expert } });
    if (consensus && hasExpertVote) await this.finish(expertCase, consensus.diagnosisId);
  }

  private async reachedConsensus(caseId: string) {
    const labels = await this.labels.find({ where: { expertCaseId: caseId, action: In([LabelAction.Confirm, LabelAction.Change]) } });
    const consensus = computeConsensus(labels);
    const minWeight = this.config.get('auth', { infer: true }).expertConsensusMinWeight;
    return consensus && consensus.weight >= minWeight ? consensus : null;
  }

  private async finish(expertCase: ExpertCaseEntity, finalDiagnosisId: string): Promise<ExpertCaseEntity> {
    await this.labels.update(
      { expertCaseId: expertCase.id, diagnosisId: finalDiagnosisId, action: In([LabelAction.Confirm, LabelAction.Change]) },
      { inDataset: true },
    );
    return this.cases.save({ ...expertCase, status: ExpertCaseStatus.Resolved, resolvedAt: new Date() });
  }

  private async openCase(caseId: string): Promise<ExpertCaseEntity> {
    const expertCase = await this.caseService.getOrFail(caseId);
    if (expertCase.status === ExpertCaseStatus.Resolved) throw new ConflictException('Case is already resolved');
    return expertCase;
  }

  private proposeNewClass(dto: CreateLabelDto, userId: string): Promise<CatalogChangeProposalEntity> {
    return this.proposals.save(this.proposals.create({
      entityType: ProposalEntityType.Diagnosis, entityId: null, operation: ProposalOperation.Create,
      payload: { ...dto.newClass }, proposedByUserId: userId,
    }));
  }
}
