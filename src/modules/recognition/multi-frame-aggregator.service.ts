import { Inject, Injectable } from '@nestjs/common';
import { VisionHypothesis, VisionOutput, VisionQuestion, UNKNOWN } from '../vision-provider/vision.types';
import { FRAME_SCORE_AGGREGATIONS } from './frame-score-aggregation';
import { PestSummary, summarisePests } from './pest-summary';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';

export interface AggregatedHypothesis {
  diagnosisCode: string;
  rawProbability: number;
  stage: string | null;
  evidence: string;
  /** photoIndex is the index of the frame (photo) the region belongs to. */
  region: VisionHypothesis['region'];
}

export interface AggregatedFrames {
  cropCode: string | null;
  organ: string | null;
  problemCategory: string | null;
  outOfDistribution: boolean;
  hypotheses: AggregatedHypothesis[];
  pest: PestSummary | null;
  questions: VisionQuestion[];
}

const mostCommonKnown = (values: string[]): string | null => {
  const counts = new Map<string, number>();
  values.filter((value) => value !== UNKNOWN).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/** One provider output per photo in, one fused result out (FR-3, 4.3 multi-frame). */
@Injectable()
export class MultiFrameAggregator {
  constructor(@Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig) {}

  aggregate(frames: VisionOutput[]): AggregatedFrames {
    const cropCode = mostCommonKnown(frames.map((frame) => frame.crop));
    return {
      cropCode,
      organ: mostCommonKnown(frames.map((frame) => frame.organ)),
      problemCategory: mostCommonKnown(frames.map((frame) => frame.problemCategory)),
      outOfDistribution: frames.filter((frame) => frame.outOfDistribution).length > frames.length * this.config.oodFrameFraction,
      hypotheses: this.fuseHypotheses(frames),
      pest: summarisePests(frames.flatMap((frame) => (frame.pest ? [frame.pest] : [])), this.plantsPerM2(cropCode)),
      questions: this.uniqueQuestions(frames),
    };
  }

  /** Plant density differs by tens of times between crops, so the global value is only the fallback for unlisted crops. */
  private plantsPerM2(cropCode: string | null): number {
    return (cropCode && this.config.plantsPerM2ByCrop[cropCode]) || this.config.plantsPerM2;
  }

  private fuseHypotheses(frames: VisionOutput[]): AggregatedHypothesis[] {
    const combine = FRAME_SCORE_AGGREGATIONS[this.config.multiframeAggregation];
    const codes = [...new Set(frames.flatMap((frame) => frame.hypotheses.map((h) => h.diagnosisCode)))];
    return codes
      .map((code) => {
        const perFrame = frames.map((frame) => frame.hypotheses.find((h) => h.diagnosisCode === code));
        const best = this.strongestFrame(perFrame);
        return {
          diagnosisCode: code,
          rawProbability: combine(perFrame.map((h) => h?.probability ?? 0), this.config.minFrameProbability),
          stage: best.hypothesis.stage,
          evidence: best.hypothesis.evidence,
          region: best.hypothesis.region ? { ...best.hypothesis.region, photoIndex: best.frameIndex } : null,
        };
      })
      .sort((a, b) => b.rawProbability - a.rawProbability);
  }

  private strongestFrame(perFrame: (VisionHypothesis | undefined)[]): { hypothesis: VisionHypothesis; frameIndex: number } {
    let best = { hypothesis: perFrame.find((h) => h) as VisionHypothesis, frameIndex: perFrame.findIndex((h) => h) };
    perFrame.forEach((hypothesis, frameIndex) => {
      if (hypothesis && hypothesis.probability > best.hypothesis.probability) best = { hypothesis, frameIndex };
    });
    return best;
  }

  private uniqueQuestions(frames: VisionOutput[]): VisionQuestion[] {
    const byId = new Map<string, VisionQuestion>();
    frames.flatMap((frame) => frame.clarifyingQuestions).forEach((question) => {
      if (!byId.has(question.id)) byId.set(question.id, question);
    });
    return [...byId.values()];
  }
}
