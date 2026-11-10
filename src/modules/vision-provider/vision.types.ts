import { Organ, PestStage, ProblemCategory } from '../../domain/enums';

export const VISION_PROVIDER = Symbol('VISION_PROVIDER');

export const UNKNOWN = 'unknown';
export const OTHER_CODE = 'other';
export type Unknown = typeof UNKNOWN;

export interface VisionPhoto { bytes: Buffer; mimeType: string }

export interface VisionContext {
  cropCode?: string;
  bbch?: number;
  temperatureC?: number;
  humidityPct?: number;
  fieldHistory?: string[];
  variety?: string;
  organHint?: string;
  answers?: Record<string, string>;
}

export interface VisionInput {
  photos: VisionPhoto[];
  context: VisionContext;
  allowedDiagnosisCodes: string[];
  locale: 'uk' | 'en';
}

export interface VisionRegion { x: number; y: number; w: number; h: number; photoIndex: number }

export interface VisionHypothesis {
  diagnosisCode: string;
  probability: number;
  stage: string | null;
  evidence: string;
  region: VisionRegion | null;
}

export interface VisionPest {
  species: string | null;
  stage: PestStage;
  countVisible: number;
  densityPerPlant: number | null;
  densityPerM2: number | null;
}

export interface VisionQuestion {
  id: string;
  textUk: string;
  textEn: string;
  answerType: 'yes_no' | 'choice';
  options?: { value: string; labelUk: string; labelEn: string }[];
  narrowsDiagnosisCodes: string[];
}

export interface VisionOutput {
  crop: string;
  organ: Organ | Unknown;
  problemCategory: ProblemCategory | Unknown;
  hypotheses: VisionHypothesis[];
  pest: VisionPest | null;
  clarifyingQuestions: VisionQuestion[];
  outOfDistribution: boolean;
  raw: unknown;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: VisionInput): Promise<VisionOutput>;
}
