import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProblemCategory, Role } from '../../domain/enums';
import { AuditService } from '../auth/audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { settings } from './__fixtures__/pipeline-fixtures';
import { AutoApproveService } from './auto-approve.service';

const user: AuthUser = { id: 'chief-1', farmId: 'farm-1', role: Role.ChiefAgronomist, email: 'chief@example.test' };
const candidate = { diagnosisId: 'diag-1', problemCategory: ProblemCategory.Disease, isQuarantine: false, isCritical: false, confidence: 0.95, needsExpert: false };

function build(rows: Record<string, unknown>[] = []) {
  const repo = {
    find: jest.fn().mockResolvedValue(rows),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => Object.entries(where).every(([k, v]) => (typeof v === 'object' && v !== null ? r[k] === null : r[k] === v))) ?? null),
    save: jest.fn(async (e: Record<string, unknown>) => ({ id: 'set-1', ...e })),
    remove: jest.fn(),
  };
  const audit = { record: jest.fn() };
  return { service: new AutoApproveService(repo as never, settings(), audit as unknown as AuditService), repo, audit };
}

const categoryRule = (overrides = {}) => ({ id: 's1', farmId: 'farm-1', problemCategory: ProblemCategory.Disease, diagnosisId: null, minConfidence: 0.9, enabled: true, ...overrides });

describe('AutoApproveService', () => {
  describe('isAutoApproved', () => {
    it('approves when an enabled category rule matches and confidence is high enough', async () => {
      expect(await build([categoryRule()]).service.isAutoApproved('farm-1', candidate)).toBe(true);
    });

    it('does not approve without a rule', async () => {
      expect(await build().service.isAutoApproved('farm-1', candidate)).toBe(false);
    });

    it('does not approve when the rule is disabled', async () => {
      expect(await build([categoryRule({ enabled: false })]).service.isAutoApproved('farm-1', candidate)).toBe(false);
    });

    it('does not approve below the rule confidence', async () => {
      expect(await build([categoryRule({ minConfidence: 0.99 })]).service.isAutoApproved('farm-1', candidate)).toBe(false);
    });

    it('never approves below the configured floor even if the rule is lower', async () => {
      expect(await build([categoryRule({ minConfidence: 0.5 })]).service.isAutoApproved('farm-1', { ...candidate, confidence: 0.8 })).toBe(false);
    });

    it('never approves quarantine, critical or expert-needing recommendations', async () => {
      const { service } = build([categoryRule()]);
      expect(await service.isAutoApproved('farm-1', { ...candidate, isQuarantine: true })).toBe(false);
      expect(await service.isAutoApproved('farm-1', { ...candidate, isCritical: true })).toBe(false);
      expect(await service.isAutoApproved('farm-1', { ...candidate, needsExpert: true })).toBe(false);
    });

    it('lets a disabled diagnosis rule override an enabled category rule', async () => {
      const rows = [categoryRule(), categoryRule({ id: 's2', problemCategory: null, diagnosisId: 'diag-1', enabled: false })];
      expect(await build(rows).service.isAutoApproved('farm-1', candidate)).toBe(false);
    });
  });

  describe('upsert', () => {
    it('saves the rule with the chief agronomist and writes an audit entry', async () => {
      const { service, repo, audit } = build();
      const dto = await service.upsert(user, { problemCategory: ProblemCategory.Disease, minConfidence: 0.95, enabled: true }, '10.0.0.1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', enabledByUserId: 'chief-1', enabled: true }));
      expect(dto).toMatchObject({ problemCategory: ProblemCategory.Disease, minConfidence: 0.95 });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'chief-1', action: 'auto_approve_setting.saved', ip: '10.0.0.1' }));
    });

    it('rejects a rule without a category or diagnosis', async () => {
      await expect(build().service.upsert(user, { minConfidence: 0.95, enabled: true })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a confidence below the configured floor', async () => {
      await expect(build().service.upsert(user, { problemCategory: ProblemCategory.Pest, minConfidence: 0.5, enabled: true })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the existing rule instead of creating a duplicate', async () => {
      const { service, repo } = build([categoryRule()]);
      await service.upsert(user, { problemCategory: ProblemCategory.Disease, minConfidence: 0.95, enabled: false });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', enabled: false }));
    });
  });

  describe('remove', () => {
    it('deletes the rule and audits it', async () => {
      const { service, repo, audit } = build([categoryRule()]);
      await service.remove(user, 's1');
      expect(repo.remove).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auto_approve_setting.removed', entityId: 's1' }));
    });

    it('fails for an unknown rule', async () => {
      await expect(build().service.remove(user, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
