import { DiagnosisPass } from '../../domain/enums';
import { DiagnosisStore } from './diagnosis-store.service';

describe('DiagnosisStore', () => {
  it('maps a region frame index to the stored photo seq and replaces old hypotheses', async () => {
    const results = {
      findOne: jest.fn().mockResolvedValue(null), create: jest.fn((v) => ({ ...v })), save: jest.fn(async (v) => ({ ...v, id: 'r1' })),
    };
    const hypotheses = { delete: jest.fn(), create: jest.fn((v) => v), save: jest.fn() };
    const store = new DiagnosisStore(results as never, hypotheses as never);
    const hypothesis = {
      rank: 1, diagnosisId: 'd1', diagnosisCode: 'rust', rawProbability: 0.8, probability: 0.7, stage: null, evidence: '',
      region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4, photoIndex: 1 },
    };
    await store.save({
      observationId: 'o1', farmId: 'f1', pass: DiagnosisPass.Initial, providerName: 'mock', modelVersion: 'm', calibrationTemperature: 1,
      answers: {}, photoSeqs: [1, 4], result: { hypotheses: [hypothesis], questions: [], rawResponse: {}, pest: null } as never,
    });
    expect(hypotheses.delete).toHaveBeenCalledWith({ diagnosisResultId: 'r1' });
    expect(hypotheses.save).toHaveBeenCalledWith([expect.objectContaining({ regionPhotoSeq: 4, regionX: 0.1 })]);
  });
});
