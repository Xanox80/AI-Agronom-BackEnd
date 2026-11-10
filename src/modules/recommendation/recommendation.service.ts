import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecommendationEntity, RecommendationItemEntity } from '../../domain/entities';
import { DomainEvent, RecommendationApprovedEvent } from '../../domain/events';
import { RecommendationStatus } from '../../domain/enums';
import { AutoApproveService } from './auto-approve.service';
import { CreateRecommendationDto, RecomputeRecommendationDto } from './dto/recommendation-request.dto';
import { RecommendationDto } from './dto/recommendation.dto';
import { DEFAULT_EXPLANATION_LOCALE } from './pipeline/explanation.messages';
import { CONSULT_EXPERT_WARNING } from './pipeline/pipeline-types';
import { RecommendationPipeline } from './pipeline/recommendation-pipeline';
import { RecommendationAssembler, AssembledRecommendation } from './recommendation.assembler';
import { AuditService } from '../auth/audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AuditAction, RECOMMENDATION_ENTITY, RequestMeta, auditEntry } from './audit-actions';
import { RecommendationInputLoader } from './recommendation-input.loader';
import { RecommendationMapper } from './recommendation.mapper';


/** Orchestrates the engine run and the draft/approve/reject lifecycle (FR-19); contains no recommendation rules itself. */
@Injectable()
export class RecommendationService {
  constructor(
    @InjectRepository(RecommendationEntity) private readonly recommendations: Repository<RecommendationEntity>,
    @InjectRepository(RecommendationItemEntity) private readonly items: Repository<RecommendationItemEntity>,
    private readonly loader: RecommendationInputLoader,
    private readonly pipeline: RecommendationPipeline,
    private readonly assembler: RecommendationAssembler,
    private readonly autoApprove: AutoApproveService,
    private readonly mapper: RecommendationMapper,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, dto: CreateRecommendationDto, meta: RequestMeta = {}): Promise<RecommendationDto> {
    const { assembled, confidence, diagnosis } = await this.compute(user, dto, meta.locale);
    const { recommendation, items } = assembled;
    const needsExpert = recommendation.safetyWarnings.some((w) => w.code === CONSULT_EXPERT_WARNING);
    const autoApproved = await this.autoApprove.isAutoApproved(user.farmId, {
      diagnosisId: diagnosis.id, problemCategory: diagnosis.category, isQuarantine: diagnosis.isQuarantine,
      isCritical: diagnosis.isCritical, confidence, needsExpert,
    });
    if (autoApproved) Object.assign(recommendation, { status: RecommendationStatus.Approved, autoApproved: true, approvedAt: new Date() });
    await this.recommendations.manager.transaction(async (manager) => {
      await manager.save(recommendation);
      await manager.save(items);
    });
    await this.audit.record(auditEntry(autoApproved ? AuditAction.RecommendationAutoApproved : AuditAction.RecommendationDrafted, user,
      RECOMMENDATION_ENTITY, recommendation.id, { actionLevel: recommendation.actionLevel, observationId: dto.observationId }, meta.ip));
    if (autoApproved) this.emitApproved(recommendation);
    return this.mapper.toDto(recommendation, items);
  }

  async get(farmId: string, id: string): Promise<RecommendationDto> {
    const recommendation = await this.find(farmId, id);
    return this.mapper.toDto(recommendation, await this.items.find({ where: { recommendationId: id } }));
  }

  async listForObservation(farmId: string, observationId: string): Promise<RecommendationDto[]> {
    const found = await this.recommendations.find({ where: { farmId, observationId }, order: { createdAt: 'DESC' } });
    return Promise.all(found.map(async (r) => this.mapper.toDto(r, await this.items.find({ where: { recommendationId: r.id } }))));
  }

  async approve(user: AuthUser, id: string, meta: RequestMeta = {}): Promise<RecommendationDto> {
    const recommendation = await this.findDraft(user.farmId, id);
    Object.assign(recommendation, { status: RecommendationStatus.Approved, approvedByUserId: user.id, approvedAt: new Date() });
    await this.recommendations.save(recommendation);
    await this.audit.record(auditEntry(AuditAction.RecommendationApproved, user, RECOMMENDATION_ENTITY, id, { actionLevel: recommendation.actionLevel }, meta.ip));
    this.emitApproved(recommendation);
    return this.get(user.farmId, id);
  }

  async reject(user: AuthUser, id: string, reason: string, meta: RequestMeta = {}): Promise<RecommendationDto> {
    const recommendation = await this.findDraft(user.farmId, id);
    Object.assign(recommendation, { status: RecommendationStatus.Rejected, rejectionReason: reason });
    await this.recommendations.save(recommendation);
    await this.audit.record(auditEntry(AuditAction.RecommendationRejected, user, RECOMMENDATION_ENTITY, id, { hasReason: true }, meta.ip));
    return this.get(user.farmId, id);
  }

  async recompute(user: AuthUser, id: string, dto: RecomputeRecommendationDto, meta: RequestMeta = {}): Promise<RecommendationDto> {
    const existing = await this.findDraft(user.farmId, id);
    const { assembled } = await this.compute(user, {
      observationId: existing.observationId, diagnosisId: existing.confirmedDiagnosisId ?? undefined, bbchStage: dto.bbchStage,
      damagePercent: dto.damagePercent,
    }, meta.locale);
    const { id: _id, createdAt: _created, updatedAt: _updated, ...fresh } = assembled.recommendation;
    Object.assign(existing, fresh);
    const items = assembled.items.map((item) => Object.assign(item, { recommendationId: existing.id }));
    await this.recommendations.manager.transaction(async (manager) => {
      await manager.delete(RecommendationItemEntity, { recommendationId: existing.id });
      await manager.save(existing);
      await manager.save(items);
    });
    await this.audit.record(auditEntry(AuditAction.RecommendationRecomputed, user, RECOMMENDATION_ENTITY, id, { actionLevel: existing.actionLevel }, meta.ip));
    return this.mapper.toDto(existing, items);
  }

  private async compute(user: AuthUser, request: CreateRecommendationDto, locale: string = DEFAULT_EXPLANATION_LOCALE) {
    const { input, diagnosisResultId } = await this.loader.load(user.farmId, request);
    const context = await this.pipeline.run(input);
    const assembled: AssembledRecommendation = this.assembler.assemble(context, {
      observationId: request.observationId, diagnosisResultId, locale,
    });
    return { assembled, confidence: input.diagnosis.probability, diagnosis: input.diagnosis };
  }

  private async find(farmId: string, id: string): Promise<RecommendationEntity> {
    const recommendation = await this.recommendations.findOne({ where: { id, farmId } });
    if (!recommendation) throw new NotFoundException('RECOMMENDATION_NOT_FOUND');
    return recommendation;
  }

  private async findDraft(farmId: string, id: string): Promise<RecommendationEntity> {
    const recommendation = await this.find(farmId, id);
    if (recommendation.status !== RecommendationStatus.Draft) throw new ConflictException('RECOMMENDATION_NOT_DRAFT');
    return recommendation;
  }

  private emitApproved(recommendation: RecommendationEntity): void {
    const event: RecommendationApprovedEvent = {
      recommendationId: recommendation.id, farmId: recommendation.farmId,
      approvedByUserId: recommendation.approvedByUserId, autoApproved: recommendation.autoApproved,
    };
    this.events.emit(DomainEvent.RecommendationApproved, event);
  }
}
