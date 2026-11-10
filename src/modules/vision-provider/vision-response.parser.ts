import { Organ, PestStage, ProblemCategory } from '../../domain/enums';
import {
  OTHER_CODE, UNKNOWN, VisionHypothesis, VisionOutput, VisionPest, VisionQuestion, VisionRegion,
} from './vision.types';

const ORGANS: string[] = [...Object.values(Organ), UNKNOWN];
const CATEGORIES: string[] = [...Object.values(ProblemCategory), UNKNOWN];
const STAGES: string[] = Object.values(PestStage);

export class InvalidVisionResponseError extends Error {}

type Json = Record<string, unknown>;

function fail(message: string): never {
  throw new InvalidVisionResponseError(message);
}

function asObject(value: unknown, what: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${what} must be an object`);
  return value as Json;
}

function asEnum(value: unknown, allowed: string[], what: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(`${what} has an unexpected value`);
  return value;
}

function unitInterval(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail(`${what} must be within 0..1`);
  return value;
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseRegion(value: unknown, photoCount: number): VisionRegion | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Json;
  const [x, y, w, h] = [r.x, r.y, r.w, r.h];
  const photoIndex = typeof r.photoIndex === 'number' ? r.photoIndex : 0;
  const inUnit = (n: unknown): n is number => typeof n === 'number' && n >= 0 && n <= 1;
  const inBounds = Number.isInteger(photoIndex) && photoIndex >= 0 && photoIndex < photoCount;
  if (!inUnit(x) || !inUnit(y) || !inUnit(w) || !inUnit(h) || !inBounds || x + w > 1 || y + h > 1) return null;
  return { x, y, w, h, photoIndex };
}

function parseHypotheses(value: unknown, allowedCodes: string[], photoCount: number, maxHypotheses: number): VisionHypothesis[] {
  if (!Array.isArray(value)) fail('hypotheses must be an array');
  const parsed = value.map((item, i): VisionHypothesis => {
    const h = asObject(item, `hypotheses[${i}]`);
    const code = text(h.diagnosisCode);
    return {
      diagnosisCode: allowedCodes.includes(code) ? code : UNKNOWN,
      probability: unitInterval(h.probability, `hypotheses[${i}].probability`),
      stage: typeof h.stage === 'string' && h.stage ? h.stage : null,
      evidence: text(h.evidence),
      region: parseRegion(h.region, photoCount),
    };
  });
  return parsed.sort((a, b) => b.probability - a.probability).slice(0, maxHypotheses);
}

function parsePest(value: unknown): VisionPest | null {
  if (value === null || value === undefined) return null;
  const p = asObject(value, 'pest');
  return {
    species: typeof p.species === 'string' && p.species ? p.species : null,
    stage: asEnum(p.stage ?? PestStage.Unknown, STAGES, 'pest.stage') as PestStage,
    countVisible: nonNegative(p.countVisible) ?? 0,
    densityPerPlant: nonNegative(p.densityPerPlant),
    densityPerM2: nonNegative(p.densityPerM2),
  };
}

function parseQuestion(item: unknown, i: number): VisionQuestion {
  const q = asObject(item, `clarifyingQuestions[${i}]`);
  const options = Array.isArray(q.options)
    ? q.options.map((o) => {
        const option = asObject(o, 'option');
        return { value: text(option.value), labelUk: text(option.labelUk), labelEn: text(option.labelEn) };
      })
    : undefined;
  return {
    id: text(q.id) || fail(`clarifyingQuestions[${i}].id is required`),
    textUk: text(q.textUk),
    textEn: text(q.textEn),
    answerType: asEnum(q.answerType, ['yes_no', 'choice'], 'answerType') as VisionQuestion['answerType'],
    options,
    narrowsDiagnosisCodes: Array.isArray(q.narrowsDiagnosisCodes) ? q.narrowsDiagnosisCodes.filter((c) => typeof c === 'string') : [],
  };
}

function parseQuestions(value: unknown): VisionQuestion[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('clarifyingQuestions must be an array');
  return value.map(parseQuestion);
}

/** Validates the provider JSON against the section 8 contract and maps it to VisionOutput. */
export function parseVisionResponse(raw: unknown, allowedCodes: string[], photoCount: number, maxHypotheses: number): VisionOutput {
  const root = asObject(raw, 'response');
  const organ = asEnum(root.organ, ORGANS, 'organ') as VisionOutput['organ'];
  const problemCategory = asEnum(root.problemCategory, CATEGORIES, 'problemCategory') as VisionOutput['problemCategory'];
  const isPest = organ === Organ.Pest || problemCategory === ProblemCategory.Pest;
  return {
    crop: text(root.crop) || UNKNOWN,
    organ,
    problemCategory,
    hypotheses: parseHypotheses(root.hypotheses, allowedCodes, photoCount, maxHypotheses),
    pest: isPest ? parsePest(root.pest) : null,
    clarifyingQuestions: parseQuestions(root.clarifyingQuestions),
    outOfDistribution: root.outOfDistribution === true,
    raw,
  };
}
