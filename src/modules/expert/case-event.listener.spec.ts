import { CaseEventListener } from './case-event.listener';

describe('CaseEventListener', () => {
  it('opens cases for completed diagnoses', async () => {
    const cases = { openForDiagnosis: jest.fn() };
    await new CaseEventListener(cases as never, {} as never).onDiagnosisCompleted({ diagnosisResultId: 'r1' } as never);
    expect(cases.openForDiagnosis).toHaveBeenCalledWith('r1');
  });

  it('records user feedback for confirmed observations', async () => {
    const feedback = { record: jest.fn() };
    await new CaseEventListener({} as never, feedback as never).onObservationConfirmed({
      observationId: 'o1', userId: 'u1', farmId: 'f1', diagnosisId: 'd1', correctedFromModel: true,
    });
    expect(feedback.record).toHaveBeenCalledWith({
      observationId: 'o1', userId: 'u1', farmId: 'f1', finalDiagnosisId: 'd1', correctedFromModel: true,
    });
  });
});
