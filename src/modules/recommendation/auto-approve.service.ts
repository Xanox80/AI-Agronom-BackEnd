import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AutoApproveSettingEntity } from '../../domain/entities';
import { ProblemCategory } from '../../domain/enums';
import { AutoApproveSettingDto, UpsertAutoApproveSettingDto } from './dto/auto-approve-setting.dto';
import { AuditService } from '../auth/audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AUTO_APPROVE_SETTING_ENTITY, AuditAction, auditEntry } from './audit-actions';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from './recommendation.settings';

export interface AutoApproveCandidate {
  diagnosisId: string; problemCategory: ProblemCategory; isQuarantine: boolean; isCritical: boolean;
  confidence: number; needsExpert: boolean;
}

const toDto = (s: AutoApproveSettingEntity): AutoApproveSettingDto => ({
  id: s.id, problemCategory: s.problemCategory, diagnosisId: s.diagnosisId, minConfidence: s.minConfidence, enabled: s.enabled,
});

/** FR-19: auto-approve rules set by the chief agronomist; quarantine and critical diagnoses are never auto-approved. */
@Injectable()
export class AutoApproveService {
  constructor(
    @InjectRepository(AutoApproveSettingEntity) private readonly settingsRepo: Repository<AutoApproveSettingEntity>,
    @Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings,
    private readonly audit: AuditService,
  ) {}

  async list(farmId: string): Promise<AutoApproveSettingDto[]> {
    return (await this.settingsRepo.find({ where: { farmId } })).map(toDto);
  }

  async upsert(user: AuthUser, dto: UpsertAutoApproveSettingDto, ip?: string): Promise<AutoApproveSettingDto> {
    if (!dto.problemCategory && !dto.diagnosisId) throw new BadRequestException('AUTO_APPROVE_SCOPE_REQUIRED');
    if (dto.minConfidence < this.settings.autoApproveMinConfidence) {
      throw new BadRequestException({ message: 'AUTO_APPROVE_CONFIDENCE_TOO_LOW', minAllowed: this.settings.autoApproveMinConfidence });
    }
    const where = { farmId: user.farmId, problemCategory: dto.problemCategory ?? IsNull(), diagnosisId: dto.diagnosisId ?? IsNull() };
    const existing = await this.settingsRepo.findOne({ where });
    const saved = await this.settingsRepo.save(Object.assign(existing ?? new AutoApproveSettingEntity(), {
      farmId: user.farmId, problemCategory: dto.problemCategory ?? null, diagnosisId: dto.diagnosisId ?? null,
      minConfidence: dto.minConfidence, enabled: dto.enabled, enabledByUserId: user.id,
    }));
    await this.audit.record(auditEntry(AuditAction.AutoApproveSettingSaved, user, AUTO_APPROVE_SETTING_ENTITY, saved.id,
      { problemCategory: saved.problemCategory, diagnosisId: saved.diagnosisId, minConfidence: saved.minConfidence, enabled: saved.enabled }, ip));
    return toDto(saved);
  }

  async remove(user: AuthUser, id: string, ip?: string): Promise<void> {
    const existing = await this.settingsRepo.findOne({ where: { id, farmId: user.farmId } });
    if (!existing) throw new NotFoundException('AUTO_APPROVE_SETTING_NOT_FOUND');
    await this.settingsRepo.remove(existing);
    await this.audit.record(auditEntry(AuditAction.AutoApproveSettingRemoved, user, AUTO_APPROVE_SETTING_ENTITY, id, {}, ip));
  }

  /** A diagnosis-specific setting overrides the category one, so it can also switch auto-approval off. */
  async isAutoApproved(farmId: string, candidate: AutoApproveCandidate): Promise<boolean> {
    if (candidate.isQuarantine || candidate.isCritical || candidate.needsExpert) return false;
    const specific = await this.settingsRepo.findOne({ where: { farmId, diagnosisId: candidate.diagnosisId } });
    const setting = specific ?? await this.settingsRepo.findOne({ where: { farmId, problemCategory: candidate.problemCategory, diagnosisId: IsNull() } });
    if (!setting?.enabled) return false;
    return candidate.confidence >= Math.max(setting.minConfidence, this.settings.autoApproveMinConfidence);
  }
}
