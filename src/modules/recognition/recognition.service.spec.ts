import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DomainEvent } from '../../domain/events';
import { DiagnosisPass } from '../../domain/enums';
import { testConfig } from './__fixtures__/recognition-fixtures';
import { UnsureReason } from './recognition.constants';
import { RecognitionService, RecognitionUnavailableError } from './recognition.service';

describe('RecognitionService', () => {
  const frames = { observation: { id: 'o1', farmId: 'f1' }, photos: [], photoSeqs: [1], context: { cropCode: 'wheat' } };
  const build = (previous: unknown = null, refined: unknown = null, result: unknown = { unsure: false }) => {
    const loader = { load: jest.fn().mockResolvedValue(frames) };
    const pipeline = { run: jest.fn().mockResolvedValue(result) };
    const store = {
      save: jest.fn().mockResolvedValue({ id: 'r2', observationId: 'o1', farmId: 'f1', unsure: true, outOfDistribution: false }),
      findById: jest.fn().mockResolvedValue(previous), findLatest: jest.fn().mockResolvedValue(null),
      findByPass: jest.fn().mockResolvedValue(refined),
    };
    const presenter = { present: jest.fn().mockResolvedValue({ id: 'r2' }) };
    const catalog = { diagnosesByCode: jest.fn().mockResolvedValue(new Map()), allowedCodes: jest.fn().mockReturnValue(['rust']) };
    const events = { emit: jest.fn() };
    const provider = { name: 'mock', model: 'mock-1', analyze: jest.fn() };
    const service = new RecognitionService(provider, testConfig(), loader as never, pipeline as never, store as never,
      presenter as never, catalog as never, events as never);
    return { service, pipeline, store, events };
  };

  it('persists with provider and model version and emits diagnosis.completed', async () => {
    const { service, store, events } = build();
    await service.diagnose('o1', 'f1', DiagnosisPass.Initial);
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ providerName: 'mock', modelVersion: 'mock-1' }));
    expect(events.emit).toHaveBeenCalledWith(DomainEvent.DiagnosisCompleted, expect.objectContaining({ diagnosisResultId: 'r2', unsure: true }));
  });

  describe('refine', () => {
    const providerFailure = { unsure: true, unsureReason: UnsureReason.ProviderError };

    it('saves a server_refined result', async () => {
      const { service, store } = build();
      await service.refine('o1', 'f1', false);
      expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ pass: DiagnosisPass.ServerRefined, photoSeqs: [1] }));
    });

    it('does not call the provider again for photos already refined', async () => {
      const { service, pipeline, store } = build(null, { unsureReason: null, rawResponse: { photoSeqs: [1] } });
      await service.refine('o1', 'f1', false);
      expect(pipeline.run).not.toHaveBeenCalled();
      expect(store.save).not.toHaveBeenCalled();
    });

    it('refines again when the photos changed or the earlier refinement was a provider failure', async () => {
      for (const refined of [{ unsureReason: null, rawResponse: { photoSeqs: [] } }, { unsureReason: UnsureReason.ProviderError, rawResponse: { photoSeqs: [1] } }]) {
        const { service, pipeline } = build(null, refined);
        await service.refine('o1', 'f1', false);
        expect(pipeline.run).toHaveBeenCalledTimes(1);
      }
    });

    it('throws instead of saving a provider failure so the queue can retry', async () => {
      const { service, store, events } = build(null, null, providerFailure);
      await expect(service.refine('o1', 'f1', false)).rejects.toBeInstanceOf(RecognitionUnavailableError);
      expect(store.save).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('saves the provider failure on the last attempt', async () => {
      const { service, store } = build(null, null, providerFailure);
      await service.refine('o1', 'f1', true);
      expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ pass: DiagnosisPass.ServerRefined }));
    });

    it('never saves a rate-limited failure, even on the last attempt', async () => {
      const rateLimit = { dailyQuotaExhausted: true };
      const { service, store } = build(null, null, { ...providerFailure, rateLimit });
      await expect(service.refine('o1', 'f1', true)).rejects.toMatchObject({ rateLimit });
      expect(store.save).not.toHaveBeenCalled();
    });
  });

  it('rejects answers to unknown questions', async () => {
    const { service } = build({ clarifyingQuestions: [{ id: 'halo' }], answers: {} });
    await expect(service.answer('r1', 'f1', { other: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an id answered in an earlier round and reranks with all asked questions', async () => {
    const asked = [{ id: 'halo' }, { id: 'spots' }];
    const { service, pipeline } = build({
      observationId: 'o1', pass: DiagnosisPass.Initial, clarifyingQuestions: [{ id: 'spots' }], answers: { halo: 'yes' }, rawResponse: { askedQuestions: asked },
    });
    await service.answer('r1', 'f1', { halo: 'yes', spots: 'a' });
    expect(pipeline.run).toHaveBeenCalledWith(expect.objectContaining({ priorQuestions: asked }));
  });

  it('404s when the result to answer does not exist', async () => {
    await expect(build().service.answer('r1', 'f1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-runs with merged answers in the locale of the original diagnosis', async () => {
    const { service, pipeline } = build({
      observationId: 'o1', pass: DiagnosisPass.Initial, clarifyingQuestions: [{ id: 'halo' }], answers: { a: 'x' }, rawResponse: { locale: 'en' },
    });
    await service.answer('r1', 'f1', { halo: 'yes' });
    expect(pipeline.run).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en', answers: { a: 'x', halo: 'yes' } }));
  });

  it('404s when there is no diagnosis for the observation', async () => {
    await expect(build().service.latest('o1', 'f1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
