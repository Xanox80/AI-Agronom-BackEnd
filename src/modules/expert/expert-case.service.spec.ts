import { ExpertCaseReason } from '../../domain/enums';
import { CasePriorityService } from './case-priority.service';
import { buildExpertConfig } from './expert.config';
import { ExpertCaseService } from './expert-case.service';

function build(result: object | null, top: object | null, rare: boolean, existing: object | null = null) {
  const saved: object[] = [];
  const cases = {
    findOne: jest.fn().mockResolvedValue(existing), create: (x: object) => x,
    save: jest.fn(async (x: object) => { saved.push(x); return x; }),
  };
  const config = buildExpertConfig({});
  const service = new ExpertCaseService(
    cases as never, { findOne: jest.fn().mockResolvedValue(result) } as never,
    { findOne: jest.fn().mockResolvedValue(top) } as never, new CasePriorityService(config),
    { isRare: jest.fn().mockResolvedValue(rare) } as never, config,
  );
  return { service, saved };
}

const result = { id: 'r1', observationId: 'o1', farmId: 'f1', outOfDistribution: false, unsure: false };

describe('ExpertCaseService', () => {
  it('opens a low-confidence case with a priority', async () => {
    const { service, saved } = build(result, { probability: 0.3, diagnosisId: 'd1' }, false);
    await service.openForDiagnosis('r1');
    expect(saved[0]).toMatchObject({ reason: ExpertCaseReason.LowConfidence, observationId: 'o1' });
    expect((saved[0] as { priority: number }).priority).toBeGreaterThan(0);
  });

  it('opens nothing for a confident common diagnosis', async () => {
    const { service, saved } = build(result, { probability: 0.9, diagnosisId: 'd1' }, false);
    expect(await service.openForDiagnosis('r1')).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it('opens a disagreement case', async () => {
    const { service, saved } = build(result, { probability: 0.9, diagnosisId: 'd1' }, false);
    await service.openForDisagreement('o1');
    expect(saved[0]).toMatchObject({ reason: ExpertCaseReason.UserModelDisagreement });
  });

  it('does not duplicate an unresolved case for the same observation', async () => {
    const { service, saved } = build(result, { probability: 0.1, diagnosisId: 'd1' }, true, { id: 'c0' });
    expect(await service.openForDiagnosis('r1')).toEqual({ id: 'c0' });
    expect(saved).toHaveLength(0);
  });
});
