import { Inject, Injectable, Logger } from '@nestjs/common';
import { CatalogDiagnosisEntity } from '../../domain/entities';
import { QuestionDto } from '../../domain/types';
import { SimilarCaseFinder } from '../similarity/similar-case-finder.service';
import { SimilarityEvidence } from '../similarity/similarity.types';
import { rateLimitOf, RetryHint } from '../vision-provider/vision-provider.error';
import { VISION_PROVIDER, VisionContext, VisionOutput, VisionPhoto, VisionProvider } from '../vision-provider/vision.types';
import { rerankWithAnswers } from './answer-reranker';
import { CalibrationService } from './calibration.service';
import { selectClarifyingQuestions } from './clarifying-question-selector';
import { AggregatedFrames, AggregatedHypothesis, MultiFrameAggregator } from './multi-frame-aggregator.service';
import { blendWithNeighbours } from './neighbour-blend';
import { PestSummary } from './pest-summary';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';
import { Locale, UNMAPPED_DIAGNOSIS_CODES, UNSURE_ANSWER, UnsureReason } from './recognition.constants';
import { UnsureEvaluator } from './unsure-evaluator.service';

export interface PipelineInput {
  photos: VisionPhoto[];
  context: VisionContext;
  locale: Locale;
  catalog: Map<string, CatalogDiagnosisEntity>;
  allowedCodes: string[];
  priorQuestions: QuestionDto[];
  answers: Record<string, string>;
}

interface AnalyzedPhoto {
  output: VisionOutput;
  photoIndex: number;
}

export interface RankedHypothesis extends AggregatedHypothesis {
  rank: number;
  diagnosisId: string | null;
  probability: number;
}

export interface PipelineResult {
  cropCode: string | null;
  organ: string | null;
  problemCategory: string | null;
  hypotheses: RankedHypothesis[];
  entropy: number;
  unsure: boolean;
  unsureReason: UnsureReason | null;
  outOfDistribution: boolean;
  needsMorePhotos: boolean;
  pest: PestSummary | null;
  questions: QuestionDto[];
  rawResponse: Record<string, unknown>;
  latencyMs: number;
  /** Set when the provider failed on every photo and at least one failure was a 429. */
  rateLimit?: RetryHint;
}

/** Code, HTTP status and attempt count only: provider messages may echo request data. */
function failureLabel(reason: { code?: string; name?: string; httpStatus?: number; attempts?: number } | undefined): string {
  const status = reason?.httpStatus ? ` HTTP ${reason.httpStatus}` : '';
  const attempts = reason?.attempts ? ` after ${reason.attempts} attempt(s)` : '';
  return `${reason?.code ?? reason?.name ?? 'Error'}${status}${attempts}`;
}

/** FR-6/7/8/9/11: provider call per photo, fusion, calibration, unsure decision. Persistence lives elsewhere. */
@Injectable()
export class RecognitionPipeline {
  private readonly logger = new Logger(RecognitionPipeline.name);

  constructor(
    @Inject(VISION_PROVIDER) private readonly provider: VisionProvider,
    @Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig,
    private readonly aggregator: MultiFrameAggregator,
    private readonly calibration: CalibrationService,
    private readonly unsure: UnsureEvaluator,
    private readonly similarity: SimilarCaseFinder,
  ) {}

  async run(input: PipelineInput): Promise<PipelineResult> {
    const startedAt = Date.now();
    const [{ frames, failures }, neighbours] = await Promise.all([
      this.analyzeEachPhoto(input),
      this.similarity.find(input.photos, input.context.cropCode ?? null, input.allowedCodes),
    ]);
    if (!frames.length) return { ...this.providerFailure(input, Date.now() - startedAt), rateLimit: rateLimitOf(failures) };

    const outputs = frames.map((frame) => frame.output);
    const fused = this.aggregator.aggregate(outputs);
    fused.hypotheses = fused.hypotheses.map((h) => (h.region
      ? { ...h, region: { ...h.region, photoIndex: frames[h.region.photoIndex].photoIndex } }
      : h));
    const blended = blendWithNeighbours(fused.hypotheses, neighbours, this.similarity.blendWeight, input.locale);
    const reranked = rerankWithAnswers(blended, input.priorQuestions, input.answers, this.config.answerEvidenceFactor);
    const { ranked, entropy } = this.calibrate(reranked, input.catalog);
    const top = ranked[0];
    const reason = this.unsure.reasonFor({
      providerFailed: false,
      providerSaysOutOfDistribution: fused.outOfDistribution,
      referencesSayOutOfDistribution: neighbours?.farFromReferences ?? false,
      topCodeKnown: !!top && !!top.diagnosisId && !UNMAPPED_DIAGNOSIS_CODES.includes(top.diagnosisCode),
      topProbability: top?.probability ?? 0,
      normalizedEntropy: entropy,
    });
    const questions = this.questionsFor(fused, ranked, reason !== null, input);
    return {
      cropCode: fused.cropCode, organ: fused.organ, problemCategory: fused.problemCategory,
      hypotheses: ranked, entropy, unsure: reason !== null, unsureReason: reason,
      outOfDistribution: fused.outOfDistribution || reason === UnsureReason.OutOfDistribution || reason === UnsureReason.HighEntropy,
      needsMorePhotos: reason !== null && input.photos.length < this.config.maxPhotos,
      pest: fused.pest,
      questions,
      rawResponse: {
        frames: outputs.map((output) => output.raw), locale: input.locale,
        askedQuestions: this.askedQuestions(input, questions),
        failedPhotoIndexes: this.failedIndexes(input.photos.length, frames),
        referenceNeighbours: this.neighbourSummary(neighbours),
      },
      latencyMs: Date.now() - startedAt,
    };
  }

  /** Calls the provider per photo in bounded batches; a failed photo is logged and skipped, survivors keep their photo index. */
  private async analyzeEachPhoto(input: PipelineInput): Promise<{ frames: AnalyzedPhoto[]; failures: unknown[] }> {
    const analyzed: AnalyzedPhoto[] = [];
    const failures: unknown[] = [];
    for (let start = 0; start < input.photos.length; start += this.config.providerConcurrency) {
      const batch = input.photos.slice(start, start + this.config.providerConcurrency);
      const settled = await Promise.allSettled(batch.map((photo) => this.provider.analyze({
        photos: [photo], context: { ...input.context, answers: this.answersForProvider(input) }, allowedDiagnosisCodes: input.allowedCodes, locale: input.locale,
      })));
      settled.forEach((outcome, offset) => {
        if (outcome.status === 'fulfilled') analyzed.push({ output: outcome.value, photoIndex: start + offset });
        else {
          failures.push(outcome.reason);
          this.logger.warn(`Provider failed on photo ${start + offset + 1} of ${input.photos.length}: ${failureLabel(outcome.reason)}`);
        }
      });
    }
    return { frames: analyzed, failures };
  }

  /** The provider sees the question text, not the opaque id, and nothing for answers of "unsure". */
  private answersForProvider(input: PipelineInput): Record<string, string> | undefined {
    const labels = new Map(input.priorQuestions.map((question) => [question.id, question.textEn || question.id]));
    const given = Object.entries(input.answers).filter(([, answer]) => answer !== UNSURE_ANSWER);
    return given.length ? Object.fromEntries(given.map(([id, answer]) => [labels.get(id) ?? id, answer])) : undefined;
  }

  /** Every question put to the scout so far, so later rounds can still weigh earlier answers (FR-11). */
  private askedQuestions(input: PipelineInput, current: QuestionDto[]): QuestionDto[] {
    return [...new Map([...input.priorQuestions, ...current].map((question) => [question.id, question])).values()];
  }

  /** Kept in the raw response so the expert loop can see what the reference base contributed. */
  private neighbourSummary(evidence: SimilarityEvidence | null): Record<string, unknown> | null {
    if (!evidence) return null;
    return {
      votes: evidence.votes, voteSource: evidence.voteSource, bestScore: evidence.bestScore,
      neighbourCount: evidence.neighbourCount, weight: this.similarity.blendWeight, examples: evidence.examples,
    };
  }

  private failedIndexes(photoCount: number, analyzed: AnalyzedPhoto[]): number[] {
    const done = new Set(analyzed.map((frame) => frame.photoIndex));
    return Array.from({ length: photoCount }, (_, index) => index).filter((index) => !done.has(index));
  }

  private calibrate(hypotheses: AggregatedHypothesis[], catalog: Map<string, CatalogDiagnosisEntity>) {
    const raw = hypotheses.map((h) => h.rawProbability);
    const residual = Math.max(0, 1 - raw.reduce((total, p) => total + p, 0));
    const critical = hypotheses.map((h) => !!(catalog.get(h.diagnosisCode)?.isCritical || catalog.get(h.diagnosisCode)?.isQuarantine));
    const calibrated = this.calibration.favourCritical(
      this.calibration.temperatureScale([...raw, residual]), [...critical, false]);
    const ranked: RankedHypothesis[] = hypotheses
      .map((h, i) => ({ ...h, probability: calibrated[i], diagnosisId: catalog.get(h.diagnosisCode)?.id ?? null, rank: 0 }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, this.config.topK)
      .map((h, i) => ({ ...h, rank: i + 1 }));
    return { ranked, entropy: this.calibration.normalizedEntropy(calibrated) };
  }

  private questionsFor(fused: AggregatedFrames, ranked: RankedHypothesis[], unsure: boolean, input: PipelineInput): QuestionDto[] {
    const margin = (ranked[0]?.probability ?? 0) - (ranked[1]?.probability ?? 0);
    return selectClarifyingQuestions({
      providerQuestions: fused.questions,
      catalogQuestions: ranked.flatMap((h) => input.catalog.get(h.diagnosisCode)?.clarifyingQuestions ?? []),
      hypothesisCodes: ranked.map((h) => h.diagnosisCode),
      needed: unsure || margin < this.config.closeMargin,
      answeredIds: Object.keys(input.answers),
    });
  }

  private providerFailure(input: PipelineInput, latencyMs: number): PipelineResult {
    return {
      cropCode: null, organ: null, problemCategory: null, hypotheses: [], entropy: 1, unsure: true,
      unsureReason: UnsureReason.ProviderError, outOfDistribution: false,
      needsMorePhotos: input.photos.length < this.config.maxPhotos,
      pest: null, questions: [], rawResponse: { frames: [], locale: input.locale, failedPhotoIndexes: this.failedIndexes(input.photos.length, []) }, latencyMs,
    };
  }
}
