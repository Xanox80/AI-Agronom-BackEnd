import { CatalogDiagnosisEntity } from '../../domain/entities';
import { AnswerType } from '../../domain/enums';
import { VisionOutput, VisionProvider } from '../vision-provider/vision.types';
import { frameOutput, hypothesis, testConfig } from './__fixtures__/recognition-fixtures';
import { CalibrationService } from './calibration.service';
import { MultiFrameAggregator } from './multi-frame-aggregator.service';
import { PipelineInput, RecognitionPipeline } from './recognition-pipeline.service';
import { RecognitionConfig } from './recognition.config';
import { UnsureReason } from './recognition.constants';
import { UnsureEvaluator } from './unsure-evaluator.service';

const diagnosis = (code: string, extra: Partial<CatalogDiagnosisEntity> = {}) =>
  ({ id: `id-${code}`, code, isCritical: false, isQuarantine: false, clarifyingQuestions: [], ...extra }) as CatalogDiagnosisEntity;

const input = (photoCount: number, overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  photos: Array.from({ length: photoCount }, () => ({ bytes: Buffer.alloc(1), mimeType: 'image/jpeg' })),
  context: {}, locale: 'uk', allowedCodes: ['rust', 'septoria'], priorQuestions: [], answers: {},
  catalog: new Map([diagnosis('rust'), diagnosis('septoria')].map((d) => [d.code, d])), ...overrides,
});

function pipelineFor(analyze: VisionProvider['analyze'], config: RecognitionConfig = testConfig()) {
  const provider: VisionProvider = { name: 'mock', model: 'mock-1', analyze };
  return new RecognitionPipeline(
    provider, config, new MultiFrameAggregator(config), new CalibrationService(config), new UnsureEvaluator(config));
}

describe('RecognitionPipeline', () => {
  it('returns a confident ranked top-3 from the fused frames', async () => {
    const outputs: VisionOutput[] = [
      frameOutput([hypothesis('rust', 0.9), hypothesis('septoria', 0.05)]),
      frameOutput([hypothesis('rust', 0.8), hypothesis('septoria', 0.1)]),
    ];
    const analyze = jest.fn().mockImplementation(async () => outputs[analyze.mock.calls.length - 1]);
    const result = await pipelineFor(analyze).run(input(2));

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(result.unsure).toBe(false);
    expect(result.hypotheses.map((h) => [h.rank, h.diagnosisCode, h.diagnosisId])).toEqual([[1, 'rust', 'id-rust'], [2, 'septoria', 'id-septoria']]);
    expect(result.hypotheses.reduce((total, h) => total + h.probability, 0)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('enters unsure mode with extra photos requested when top-1 is below the threshold', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.4), hypothesis('septoria', 0.35)]));
    const result = await pipelineFor(analyze).run(input(1));

    expect(result).toMatchObject({ unsure: true, unsureReason: UnsureReason.LowConfidence, needsMorePhotos: true });
  });

  it('does not ask for more photos when the maximum is already used', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.4), hypothesis('septoria', 0.35)]));
    expect((await pipelineFor(analyze).run(input(3))).needsMorePhotos).toBe(false);
  });

  it('treats an unmapped top code as unknown', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('other', 0.95)]));
    expect((await pipelineFor(analyze).run(input(1))).unsureReason).toBe(UnsureReason.UnknownCode);
  });

  it('flags out of distribution reported by the provider', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([], { outOfDistribution: true }));
    const result = await pipelineFor(analyze).run(input(1));
    expect(result).toMatchObject({ unsure: true, outOfDistribution: true, unsureReason: UnsureReason.OutOfDistribution });
  });

  it('returns unsure with provider_error when every frame fails', async () => {
    const analyze = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await pipelineFor(analyze).run(input(2));
    expect(result).toMatchObject({ unsure: true, unsureReason: UnsureReason.ProviderError, hypotheses: [] });
  });

  it('survives one failed frame and uses the rest', async () => {
    const analyze = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(frameOutput([hypothesis('rust', 0.9)]));
    const result = await pipelineFor(analyze).run(input(2));
    expect(result.hypotheses[0].diagnosisCode).toBe('rust');
  });

  it('asks catalogue questions when the top two classes are close', async () => {
    const question = { id: 'halo', textUk: '', textEn: '', answerType: AnswerType.YesNo, narrowsDiagnosisCodes: ['septoria'] };
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.5), hypothesis('septoria', 0.42)]));
    const catalog = new Map([diagnosis('rust'), diagnosis('septoria', { clarifyingQuestions: [question] })].map((d) => [d.code, d]));
    const result = await pipelineFor(analyze).run(input(1, { catalog }));
    expect(result.questions.map((q) => q.id)).toEqual(['halo']);
  });

  it('does not pass the answered questions on again after answers are given', async () => {
    const question = { id: 'halo', textUk: '', textEn: '', answerType: AnswerType.YesNo, narrowsDiagnosisCodes: ['septoria'] };
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.5), hypothesis('septoria', 0.42)]));
    const result = await pipelineFor(analyze).run(input(1, { answers: { halo: 'yes' }, priorQuestions: [question] }));
    expect(result.questions).toEqual([]);
    expect(result.hypotheses[0].diagnosisCode).toBe('septoria');
  });

  it('keeps the original photo index on regions when an earlier photo failed', async () => {
    const region = { x: 0.1, y: 0.1, w: 0.2, h: 0.2, photoIndex: 0 };
    const analyze = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(frameOutput([hypothesis('rust', 0.9, { region })]));
    const result = await pipelineFor(analyze).run(input(2));
    expect(result.hypotheses[0].region?.photoIndex).toBe(1);
    expect(result.rawResponse.failedPhotoIndexes).toEqual([0]);
  });

  it('never runs more provider calls at once than the configured concurrency', async () => {
    let running = 0;
    let peak = 0;
    const analyze = jest.fn().mockImplementation(async () => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
      return frameOutput([hypothesis('rust', 0.9)]);
    });
    await pipelineFor(analyze, testConfig({ providerConcurrency: 1 })).run(input(3));
    expect(peak).toBe(1);
    expect(analyze).toHaveBeenCalledTimes(3);
  });

  it('sends the scout answers to the provider as question text, skipping "unsure"', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.9)]));
    const question = { id: 'halo', textUk: '', textEn: 'Is there a halo?', answerType: AnswerType.YesNo, narrowsDiagnosisCodes: [] };
    await pipelineFor(analyze).run(input(1, { answers: { halo: 'yes', other: 'unsure' }, priorQuestions: [question] }));
    expect(analyze.mock.calls[0][0].context.answers).toEqual({ 'Is there a halo?': 'yes' });
  });

  it('keeps answered questions in the asked list for later rounds', async () => {
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.9)]));
    const question = { id: 'halo', textUk: '', textEn: '', answerType: AnswerType.YesNo, narrowsDiagnosisCodes: [] };
    const result = await pipelineFor(analyze).run(input(1, { answers: { halo: 'yes' }, priorQuestions: [question] }));
    expect((result.rawResponse.askedQuestions as { id: string }[]).map((q) => q.id)).toEqual(['halo']);
  });

  it('boosts critical classes with the recall bias', async () => {
    const config = testConfig({ criticalRecallBias: 0.5 });
    const catalog = new Map([diagnosis('rust'), diagnosis('septoria', { isCritical: true })].map((d) => [d.code, d]));
    const analyze = jest.fn().mockResolvedValue(frameOutput([hypothesis('rust', 0.45), hypothesis('septoria', 0.45)]));
    expect((await pipelineFor(analyze, config).run(input(1, { catalog }))).hypotheses[0].diagnosisCode).toBe('septoria');
  });
});
