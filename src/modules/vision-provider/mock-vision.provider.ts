import { createHash } from 'crypto';
import { Organ, ProblemCategory } from '../../domain/enums';
import { UNKNOWN, VisionInput, VisionOutput, VisionProvider, VisionQuestion } from './vision.types';

const MOCK_TOP_PROBABILITY = 0.6;
const MOCK_PROBABILITY_DECAY = 0.4;
const MOCK_EVIDENCE = { uk: 'Демонстраційне пояснення (mock).', en: 'Demonstration explanation (mock).' };
const MOCK_QUESTION_ID = 'mock_spread_pattern';

/** Deterministic stand-in: the same photos and catalogue always yield the same ranking. */
export class MockVisionProvider implements VisionProvider {
  readonly name = 'mock';
  readonly model = 'mock-1';

  constructor(private readonly maxHypotheses: number) {}

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const codes = input.allowedDiagnosisCodes;
    const crop = input.context.cropCode ?? UNKNOWN;
    const organ = (input.context.organHint as Organ | undefined) ?? Organ.Leaf;
    if (!codes.length || !input.photos.length) {
      return this.build(crop, organ, [], [], true, input.locale);
    }
    const start = this.fingerprint(input) % codes.length;
    const picked = Array.from({ length: Math.min(this.maxHypotheses, codes.length) }, (_, i) => ({
      diagnosisCode: codes[(start + i) % codes.length],
      probability: MOCK_TOP_PROBABILITY * MOCK_PROBABILITY_DECAY ** i,
    }));
    const questions = input.context.answers ? [] : [this.question(picked.map((p) => p.diagnosisCode))];
    return this.build(crop, organ, picked, questions, false, input.locale);
  }

  private fingerprint(input: VisionInput): number {
    const hash = createHash('sha256');
    input.photos.forEach((p) => hash.update(p.bytes));
    return hash.digest().readUInt32BE(0);
  }

  private question(codes: string[]): VisionQuestion {
    return {
      id: MOCK_QUESTION_ID,
      textUk: 'Чи уражені рослини смугами або осередками?',
      textEn: 'Are the plants affected in stripes or patches?',
      answerType: 'yes_no',
      narrowsDiagnosisCodes: codes.slice(0, 2),
    };
  }

  private build(
    crop: string, organ: Organ, picked: { diagnosisCode: string; probability: number }[],
    clarifyingQuestions: VisionQuestion[], outOfDistribution: boolean, locale: VisionInput['locale'],
  ): VisionOutput {
    const output: VisionOutput = {
      crop,
      organ: outOfDistribution ? UNKNOWN : organ,
      problemCategory: outOfDistribution ? UNKNOWN : ProblemCategory.Disease,
      hypotheses: picked.map((p) => ({ ...p, stage: null, evidence: MOCK_EVIDENCE[locale], region: null })),
      pest: null,
      clarifyingQuestions,
      outOfDistribution,
      raw: null,
    };
    return { ...output, raw: { provider: this.name, hypotheses: output.hypotheses.length } };
  }
}
