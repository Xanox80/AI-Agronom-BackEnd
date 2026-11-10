import type { Geometry } from 'geojson';
import {
  ActionLevel, AnswerType, DiagnosisPass, FieldLinkMethod, ObservationStatus, Organ, PestStage,
  ProblemCategory, RecommendationStatus, Role, WeatherVerdict,
} from './enums';

export interface QualityReport {
  sharpness: number;
  exposure: number;
  plantCoverage: number;
  objectSize: number;
  passed: boolean;
}

export interface QuestionOptionDto { value: string; labelUk: string; labelEn: string }

export interface QuestionDto {
  id: string;
  textUk: string;
  textEn: string;
  answerType: AnswerType;
  options?: QuestionOptionDto[];
  narrowsDiagnosisCodes: string[];
}

export interface RegionDto { x: number; y: number; w: number; h: number; photoSeq: number }

export interface AffectedRegion { type: 'rect' | 'polygon'; points: { x: number; y: number }[]; photoSeq: number }

export interface SafetyWarning { code: string; params: Record<string, unknown>; severity: 'info' | 'warning' | 'critical' }

export interface RecommendationSource { kind: string; ref: string; verifiedAt?: string | null }

export interface ResistanceGroupUse { system: string; group: string }

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

export interface UserDto {
  id: string; email: string; displayName: string; role: Role; locale: string;
  geoCollectionEnabled: boolean; trustWeight: number; farmId: string; regionCode: string | null;
}

export interface FarmDto {
  id: string; name: string; regionCode: string; timezone: string;
  defaultSafetyBuffers: { waterM: number; apiaryM: number; settlementM: number };
}

export interface FieldDto {
  id: string; clientId?: string; name: string; areaHa: number; cropId?: string; cropCode?: string;
  variety?: string; sowingDate?: string; contour?: Geometry; centroid?: { lat: number; lng: number };
  source: string; nearWater: boolean; nearApiary: boolean; nearSettlement: boolean;
}

export interface PhotoDto {
  id: string; clientId: string; seq: number; widthPx: number; heightPx: number;
  qualityReport: QualityReport | null; url: string;
}

export interface VoiceNoteDto { id: string; clientId: string; durationSec: number; transcript?: string; url: string }

export interface HypothesisDto {
  rank: number; diagnosisId?: string; diagnosisCode: string; nameUk: string; nameEn: string;
  probability: number; stage?: string; evidence: string; region?: RegionDto;
}

export interface ReferenceImageDto { id: string; diagnosisCode: string; stage?: string; url: string; caption: string; attribution: string }

export interface DiagnosisResultDto {
  id: string; observationId: string; pass: DiagnosisPass; modelVersion: string; cropCode?: string;
  organ?: Organ; problemCategory?: ProblemCategory; unsure: boolean; unsureReason?: string;
  outOfDistribution: boolean; hypotheses: HypothesisDto[];
  pest?: { species?: string; stage?: PestStage; densityPerPlant?: number; densityPerM2?: number };
  clarifyingQuestions: QuestionDto[]; answers: Record<string, string>;
  referenceImages: ReferenceImageDto[]; needsMorePhotos: boolean; createdAt: string;
}

export interface ObservationDto {
  id: string; clientId: string; fieldId?: string; fieldLinkMethod: FieldLinkMethod; cropId?: string;
  bbchStage?: number; lat?: number; lng?: number; gpsAccuracyM?: number; capturedAt: string;
  deviceModel?: string; temperatureC?: number; humidityPct?: number; organ?: Organ; textNote?: string;
  scaleMarkerUsed: boolean; isQuickCapture: boolean; status: ObservationStatus; photos: PhotoDto[];
  voiceNote?: VoiceNoteDto; confirmedDiagnosisId?: string; diagnosis?: DiagnosisResultDto;
}

export interface RecommendationSummaryDto {
  id: string; observationId: string; status: RecommendationStatus; actionLevel: ActionLevel;
  weatherVerdict?: WeatherVerdict; autoApproved: boolean;
}
