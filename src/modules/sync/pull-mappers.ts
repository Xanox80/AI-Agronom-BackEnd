import {
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity, ObservationEntity, PhotoEntity, RecommendationEntity,
  TaskEntity, TreatmentEntity,
} from '../../domain/entities';
import type { RecommendationSummaryDto } from '../../domain/types';

const iso = (date: Date | null): string | undefined => date?.toISOString();
const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

export function toSyncField(row: FieldEntity) {
  return {
    id: row.id, clientId: row.clientId, name: row.name, areaHa: row.areaHa, cropId: orUndefined(row.cropId),
    variety: orUndefined(row.variety), sowingDate: orUndefined(row.sowingDate), contour: orUndefined(row.contour),
    centroid: row.centroidLat === null || row.centroidLng === null ? undefined : { lat: row.centroidLat, lng: row.centroidLng },
    source: row.source, nearWater: row.nearWater, nearApiary: row.nearApiary, nearSettlement: row.nearSettlement,
  };
}

export function toSyncTask(row: TaskEntity) {
  return {
    id: row.id, clientId: row.clientId, type: row.type, fieldId: row.fieldId, observationId: orUndefined(row.observationId),
    lat: orUndefined(row.lat), lng: orUndefined(row.lng), diagnosisId: orUndefined(row.diagnosisId),
    recommendationId: orUndefined(row.recommendationId), photoIds: row.photoIds, priority: row.priority,
    assigneeUserId: orUndefined(row.assigneeUserId), deadline: iso(row.deadline), status: row.status, title: row.title,
    notes: row.notes, completedAt: iso(row.completedAt), createdAt: iso(row.createdAt),
  };
}

export function toSyncTreatment(row: TreatmentEntity) {
  return {
    id: row.id, clientId: row.clientId, fieldId: row.fieldId, taskId: orUndefined(row.taskId), productId: row.productId,
    activeSubstanceCodes: row.activeSubstanceCodes, resistanceGroups: row.resistanceGroups, doseValue: row.doseValue,
    doseUnit: row.doseUnit, treatedAreaHa: row.treatedAreaHa, appliedAt: row.appliedAt,
  };
}

export function toSyncObservation(row: ObservationEntity, photos: PhotoEntity[], photoUrlPrefix: string) {
  return {
    id: row.id, clientId: row.clientId, fieldId: orUndefined(row.fieldId), fieldLinkMethod: row.fieldLinkMethod,
    cropId: orUndefined(row.cropId), bbchStage: orUndefined(row.bbchStage), lat: orUndefined(row.lat), lng: orUndefined(row.lng),
    gpsAccuracyM: orUndefined(row.gpsAccuracyM), capturedAt: iso(row.capturedAt), deviceModel: orUndefined(row.deviceModel),
    temperatureC: orUndefined(row.temperatureC), humidityPct: orUndefined(row.humidityPct), organ: orUndefined(row.organ),
    textNote: orUndefined(row.textNote), scaleMarkerUsed: row.scaleMarkerUsed, isQuickCapture: row.isQuickCapture,
    status: row.status, confirmedDiagnosisId: orUndefined(row.confirmedDiagnosisId),
    photos: photos.map((photo) => ({
      id: photo.id, clientId: photo.clientId, seq: photo.seq, widthPx: photo.widthPx, heightPx: photo.heightPx,
      qualityReport: photo.qualityReport, url: `${photoUrlPrefix}/${photo.id}/file`,
    })),
  };
}

export function toSyncDiagnosis(row: DiagnosisResultEntity, hypotheses: DiagnosisHypothesisEntity[]) {
  return {
    id: row.id, observationId: row.observationId, pass: row.pass, modelVersion: row.modelVersion,
    cropCode: orUndefined(row.cropCode), organ: orUndefined(row.organ), problemCategory: orUndefined(row.problemCategory),
    unsure: row.unsure, unsureReason: orUndefined(row.unsureReason), outOfDistribution: row.outOfDistribution,
    clarifyingQuestions: row.clarifyingQuestions, answers: row.answers, createdAt: iso(row.createdAt),
    hypotheses: hypotheses.map((h) => ({
      rank: h.rank, diagnosisId: orUndefined(h.diagnosisId), diagnosisCode: h.diagnosisCode, probability: h.probability,
      stage: orUndefined(h.stage), evidence: h.evidence,
      region: h.regionX === null ? undefined : { x: h.regionX, y: h.regionY, w: h.regionW, h: h.regionH, photoSeq: h.regionPhotoSeq },
    })),
  };
}

export function toSyncRecommendation(row: RecommendationEntity): RecommendationSummaryDto {
  return {
    id: row.id, observationId: row.observationId, status: row.status, actionLevel: row.actionLevel,
    weatherVerdict: orUndefined(row.weatherVerdict), autoApproved: row.autoApproved,
  };
}
