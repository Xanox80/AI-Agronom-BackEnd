import { ConflictException, NotFoundException } from '@nestjs/common';
import { ActionLevel, ProblemCategory, RecommendationStatus, Role } from '../../domain/enums';
import { RecommendationEntity } from '../../domain/entities';
import { AuthUser } from '../auth/auth.types';
import { contextFor, pipelineInput } from './__fixtures__/pipeline-fixtures';
import { RecommendationService } from './recommendation.service';

const user: AuthUser = { id: 'user-1', farmId: 'farm-1', role: Role.ChiefAgronomist, email: 'u@example.test' };

function draft(overrides: Partial<RecommendationEntity> = {}): RecommendationEntity {
  return Object.assign(new RecommendationEntity(), {
    id: 'rec-1', farmId: 'farm-1', observationId: 'obs-1', confirmedDiagnosisId: 'diag-1', status: RecommendationStatus.Draft,
    actionLevel: ActionLevel.Treat, safetyWarnings: [], autoApproved: false, approvedByUserId: null, ...overrides,
  });
}

function build(stored: RecommendationEntity | null = draft(), autoApproved = false) {
  const manager: Record<string, jest.Mock> = { save: jest.fn(), delete: jest.fn() };
  manager.transaction = jest.fn(async (work: (m: unknown) => Promise<void>) => work(manager));
  const recommendations = { findOne: jest.fn().mockResolvedValue(stored), find: jest.fn().mockResolvedValue(stored ? [stored] : []), save: jest.fn(), manager };
  const items = { find: jest.fn().mockResolvedValue([]) };
  const input = pipelineInput();
  const loader = { load: jest.fn().mockResolvedValue({ input, diagnosisResultId: 'res-1' }) };
  const pipeline = { run: jest.fn().mockResolvedValue(contextFor()) };
  const fresh = draft({ id: 'new-id', actionLevel: ActionLevel.Observe });
  const assembler = { assemble: jest.fn().mockReturnValue({ recommendation: fresh, items: [{ rank: 1 }] }) };
  const autoApprove = { isAutoApproved: jest.fn().mockResolvedValue(autoApproved) };
  const mapper = { toDto: jest.fn(async (r: RecommendationEntity) => ({ id: r.id, status: r.status })) };
  const audit = { record: jest.fn() };
  const events = { emit: jest.fn() };
  const service = new RecommendationService(recommendations as never, items as never, loader as never, pipeline as never,
    assembler as never, autoApprove as never, mapper as never, audit as never, events as never);
  return { service, recommendations, manager, loader, assembler, autoApprove, audit, events, fresh };
}

describe('RecommendationService', () => {
  describe('create', () => {
    it('persists a draft and audits who created it', async () => {
      const { service, manager, audit, events, loader } = build();
      const dto = await service.create(user, { observationId: 'obs-1' }, { ip: '1.1.1.1', locale: 'en' });
      expect(loader.load).toHaveBeenCalledWith('farm-1', { observationId: 'obs-1' });
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(dto.status).toBe(RecommendationStatus.Draft);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'recommendation.drafted', userId: 'user-1', ip: '1.1.1.1' }));
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('auto-approves when the rule engine says so and records it as automatic', async () => {
      const { service, events, audit, autoApprove } = build(draft(), true);
      const dto = await service.create(user, { observationId: 'obs-1' });
      expect(autoApprove.isAutoApproved).toHaveBeenCalledWith('farm-1', expect.objectContaining({ problemCategory: ProblemCategory.Disease, confidence: 0.9 }));
      expect(dto.status).toBe(RecommendationStatus.Approved);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'recommendation.auto_approved' }));
      expect(events.emit).toHaveBeenCalledWith('recommendation.approved', expect.objectContaining({ autoApproved: true }));
    });

    it('flags that an expert is needed so auto-approval is withheld', async () => {
      const { service, autoApprove, fresh } = build();
      fresh.safetyWarnings = [{ code: 'consult_expert', params: {}, severity: 'warning' }];
      await service.create(user, { observationId: 'obs-1' });
      expect(autoApprove.isAutoApproved).toHaveBeenCalledWith('farm-1', expect.objectContaining({ needsExpert: true }));
    });
  });

  describe('approve', () => {
    it('records the approver, the time and an audit entry', async () => {
      const stored = draft();
      const { service, audit, events } = build(stored);
      await service.approve(user, 'rec-1', { ip: '2.2.2.2' });
      expect(stored.status).toBe(RecommendationStatus.Approved);
      expect(stored.approvedByUserId).toBe('user-1');
      expect(stored.approvedAt).toBeInstanceOf(Date);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'recommendation.approved', userId: 'user-1', entityId: 'rec-1' }));
      expect(events.emit).toHaveBeenCalledWith('recommendation.approved', expect.objectContaining({ approvedByUserId: 'user-1', autoApproved: false }));
    });

    it('refuses to approve a recommendation that is not a draft', async () => {
      await expect(build(draft({ status: RecommendationStatus.Rejected })).service.approve(user, 'rec-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not see recommendations of another farm', async () => {
      await expect(build(null).service.approve(user, 'rec-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reject', () => {
    it('stores the reason and audits the rejection', async () => {
      const stored = draft();
      const { service, audit } = build(stored);
      await service.reject(user, 'rec-1', 'wrong crop stage');
      expect(stored.status).toBe(RecommendationStatus.Rejected);
      expect(stored.rejectionReason).toBe('wrong crop stage');
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'recommendation.rejected', meta: { hasReason: true } }));
    });
  });

  describe('recompute', () => {
    it('refreshes a draft in place with the same id and keeps it a draft', async () => {
      const stored = draft();
      const { service, manager, loader } = build(stored);
      await service.recompute(user, 'rec-1', { bbchStage: 45 });
      expect(loader.load).toHaveBeenCalledWith('farm-1', { observationId: 'obs-1', diagnosisId: 'diag-1', bbchStage: 45 });
      expect(stored.id).toBe('rec-1');
      expect(stored.actionLevel).toBe(ActionLevel.Observe);
      expect(stored.status).toBe(RecommendationStatus.Draft);
      expect(manager.delete).toHaveBeenCalled();
    });

    it('refuses to recompute an approved recommendation', async () => {
      await expect(build(draft({ status: RecommendationStatus.Approved })).service.recompute(user, 'rec-1', {})).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('lists recommendations of an observation within the farm', async () => {
    const { service, recommendations } = build();
    expect(await service.listForObservation('farm-1', 'obs-1')).toHaveLength(1);
    expect(recommendations.find).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: 'farm-1', observationId: 'obs-1' } }));
  });
});
