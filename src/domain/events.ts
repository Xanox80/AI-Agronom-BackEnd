export const DomainEvent = {
  ObservationCreated: 'observation.created',
  ObservationConfirmed: 'observation.confirmed',
  PhotoUploaded: 'photo.uploaded',
  DiagnosisCompleted: 'diagnosis.completed',
  RecommendationApproved: 'recommendation.approved',
  TaskCompleted: 'task.completed',
  CatalogPublished: 'catalog.published',
} as const;

export interface ObservationCreatedEvent { observationId: string; farmId: string; userId: string }
export interface ObservationConfirmedEvent {
  observationId: string; farmId: string; userId: string;
  diagnosisId: string; correctedFromModel: boolean; correctedFromDiagnosisId?: string;
}
export interface PhotoUploadedEvent { photoId: string; observationId: string; farmId: string }
export interface DiagnosisCompletedEvent {
  diagnosisResultId: string; observationId: string; farmId: string; pass: string; unsure: boolean; outOfDistribution: boolean;
}
export interface RecommendationApprovedEvent { recommendationId: string; farmId: string; approvedByUserId: string | null; autoApproved: boolean }
export interface TaskCompletedEvent { taskId: string; farmId: string; fieldId: string; treatmentId?: string }
export interface CatalogPublishedEvent { regionCode: string; version: number }
