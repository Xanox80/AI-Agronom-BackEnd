import { LabelAction } from '../../domain/enums';
import { UserFeedbackService } from './user-feedback.service';

function build(observation: object | null) {
  const saved: object[] = [];
  const labels = { findOne: jest.fn().mockResolvedValue(null), create: (x: object) => x, save: jest.fn(async (x: object) => saved.push(x)) };
  const cases = { openForDisagreement: jest.fn().mockResolvedValue({ id: 'c1' }), findUnresolved: jest.fn().mockResolvedValue(null) };
  const service = new UserFeedbackService(
    labels as never, { findOne: jest.fn().mockResolvedValue(observation) } as never,
    { findOne: jest.fn().mockResolvedValue({ id: 'u1', role: 'scout', trustWeight: 1 }) } as never,
    cases as never, { weightFor: () => 1 } as never,
  );
  return { service, saved, cases };
}

const feedback = { observationId: 'o1', userId: 'u1', farmId: 'f1', finalDiagnosisId: 'd2', correctedFromModel: true };

describe('UserFeedbackService', () => {
  it('stores a weighted change label and opens a disagreement case', async () => {
    const { service, saved, cases } = build({ id: 'o1' });
    await service.record(feedback);
    expect(cases.openForDisagreement).toHaveBeenCalledWith('o1');
    expect(saved[0]).toMatchObject({ action: LabelAction.Change, diagnosisId: 'd2', weight: 1, expertCaseId: 'c1', inDataset: false });
  });

  it('stores a confirm label without opening a case when the user agrees', async () => {
    const { service, saved, cases } = build({ id: 'o1' });
    await service.record({ ...feedback, correctedFromModel: false });
    expect(cases.openForDisagreement).not.toHaveBeenCalled();
    expect(saved[0]).toMatchObject({ action: LabelAction.Confirm, expertCaseId: null, inDataset: true });
  });

  it('rejects feedback for an unknown observation', async () => {
    await expect(build(null).service.record(feedback)).rejects.toThrow('Observation not found');
  });
});
