import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent, DiagnosisCompletedEvent } from '../../domain/events';
import { DiagnosisResultEntity } from '../../domain/entities';
import { QuestionDto } from '../../domain/types';
import { DiagnosisPass } from '../../domain/enums';
import { RetryHint } from '../vision-provider/vision-provider.error';
import { VISION_PROVIDER, VisionProvider } from '../vision-provider/vision.types';
import { CatalogReader } from './catalog-reader.service';
import { DiagnosisPresenter, RecognitionResultDto } from './diagnosis-presenter.service';
import { DiagnosisStore } from './diagnosis-store.service';
import { ObservationContextLoader, ObservationFrames } from './observation-context-loader.service';
import { PipelineResult, RecognitionPipeline } from './recognition-pipeline.service';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';
import { Locale, UnsureReason } from './recognition.constants';

/** The provider failed on every photo; the refinement queue retries instead of storing an empty result. */
export class RecognitionUnavailableError extends Error {
  constructor(readonly rateLimit?: RetryHint) {
    super(rateLimit ? 'Vision provider is rate-limited' : 'Vision provider failed on every photo');
    this.name = 'RecognitionUnavailableError';
  }
}

export interface RecognitionStatusDto {
  provider: string;
  model: string;
  thresholds: { unsure: number; ood: number };
  temperature: number;
}

@Injectable()
export class RecognitionService {
  constructor(
    @Inject(VISION_PROVIDER) private readonly provider: VisionProvider,
    @Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig,
    private readonly loader: ObservationContextLoader,
    private readonly pipeline: RecognitionPipeline,
    private readonly store: DiagnosisStore,
    private readonly presenter: DiagnosisPresenter,
    private readonly catalog: CatalogReader,
    private readonly events: EventEmitter2,
  ) {}

  /** Pass `initial` on request, `server_refined` after sync (FR-26); an unsure result reaches the expert queue via the event. */
  async diagnose(observationId: string, farmId: string, pass: DiagnosisPass, locale?: Locale): Promise<RecognitionResultDto> {
    const frames = await this.loader.load(observationId, farmId);
    const saved = await this.run(frames, pass, {}, [], locale);
    return this.presenter.present(saved);
  }

  /**
   * FR-26 server pass after sync. Photos already refined successfully are not sent to the provider again;
   * a provider failure is stored only on the last attempt, earlier ones throw so the queue retries.
   * A rate-limited provider always throws: an exhausted quota says nothing about the photos.
   */
  async refine(observationId: string, farmId: string, lastAttempt: boolean): Promise<void> {
    const frames = await this.loader.load(observationId, farmId);
    const previous = await this.store.findByPass(observationId, farmId, DiagnosisPass.ServerRefined);
    if (previous && previous.unsureReason !== UnsureReason.ProviderError && coversPhotos(previous, frames.photoSeqs)) return;
    const result = await this.analyze(frames, {}, []);
    if (result.rateLimit || (result.unsureReason === UnsureReason.ProviderError && !lastAttempt)) {
      throw new RecognitionUnavailableError(result.rateLimit);
    }
    await this.persist(frames, DiagnosisPass.ServerRefined, {}, result);
  }

  /** FR-11: re-run the provider with the answers (sent as facts) and re-rank; earlier rounds' answers stay in force. */
  async answer(resultId: string, farmId: string, answers: Record<string, string>): Promise<RecognitionResultDto> {
    const previous = await this.store.findById(resultId, farmId);
    if (!previous) throw new NotFoundException('Diagnosis result not found');
    const asked = (previous.rawResponse?.askedQuestions as QuestionDto[] | undefined) ?? previous.clarifyingQuestions;
    const known = new Set([...asked, ...previous.clarifyingQuestions].map((question) => question.id).concat(Object.keys(previous.answers)));
    const unknown = Object.keys(answers).filter((id) => !known.has(id));
    if (unknown.length) throw new BadRequestException(`Unknown question ids: ${unknown.join(', ')}`);
    if (Object.values(answers).some((value) => typeof value !== 'string' || !value)) {
      throw new BadRequestException('Answers must be non-empty strings');
    }
    const frames = await this.loader.load(previous.observationId, farmId);
    const saved = await this.run(frames, previous.pass, { ...previous.answers, ...answers }, asked, previous.rawResponse?.locale as Locale | undefined);
    return this.presenter.present(saved);
  }

  async latest(observationId: string, farmId: string): Promise<RecognitionResultDto> {
    const latest = await this.store.findLatest(observationId, farmId);
    if (!latest) throw new NotFoundException('No diagnosis for this observation');
    return this.presenter.present(latest);
  }

  status(): RecognitionStatusDto {
    return {
      provider: this.provider.name, model: this.provider.model, temperature: this.config.calibrationTemperature,
      thresholds: { unsure: this.config.unsureThreshold, ood: this.config.oodEntropyThreshold },
    };
  }

  private async run(
    frames: ObservationFrames,
    pass: DiagnosisPass,
    answers: Record<string, string>,
    priorQuestions: DiagnosisResultEntity['clarifyingQuestions'],
    locale?: Locale,
  ): Promise<DiagnosisResultEntity> {
    return this.persist(frames, pass, answers, await this.analyze(frames, answers, priorQuestions, locale));
  }

  private async analyze(
    frames: ObservationFrames,
    answers: Record<string, string>,
    priorQuestions: DiagnosisResultEntity['clarifyingQuestions'],
    locale: Locale = this.config.defaultLocale,
  ): Promise<PipelineResult> {
    const catalog = await this.catalog.diagnosesByCode();
    return this.pipeline.run({
      photos: frames.photos, context: frames.context, locale, catalog, answers, priorQuestions,
      allowedCodes: this.catalog.allowedCodes(catalog, frames.context.cropCode),
    });
  }

  private async persist(
    frames: ObservationFrames, pass: DiagnosisPass, answers: Record<string, string>, result: PipelineResult,
  ): Promise<DiagnosisResultEntity> {
    const saved = await this.store.save({
      observationId: frames.observation.id, farmId: frames.observation.farmId, pass,
      providerName: this.provider.name, modelVersion: this.provider.model,
      calibrationTemperature: this.config.calibrationTemperature, answers, photoSeqs: frames.photoSeqs, result,
    });
    const event: DiagnosisCompletedEvent = {
      diagnosisResultId: saved.id, observationId: saved.observationId, farmId: saved.farmId, pass,
      unsure: saved.unsure, outOfDistribution: saved.outOfDistribution,
    };
    this.events.emit(DomainEvent.DiagnosisCompleted, event);
    return saved;
  }
}

function coversPhotos(result: DiagnosisResultEntity, photoSeqs: number[]): boolean {
  const covered = result.rawResponse?.photoSeqs;
  return Array.isArray(covered) && covered.length === photoSeqs.length && photoSeqs.every((seq, i) => covered[i] === seq);
}
