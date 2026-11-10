import { TaskPriority, TaskStatus, TaskType } from '../../../domain/enums';
import type { ResistanceGroupUse } from '../../../domain/types';

export interface TaskResponseDto {
  id: string; clientId: string; type: TaskType; fieldId: string; fieldName?: string;
  observationId?: string; lat?: number; lng?: number; diagnosisId?: string; diagnosisName?: string;
  recommendationId?: string; photoUrls: string[]; priority: TaskPriority; assigneeUserId?: string;
  assigneeName?: string; deadline?: string; status: TaskStatus; title: string; notes: string;
  completedAt?: string; createdAt: string;
}

export interface TreatmentResponseDto {
  id: string; clientId: string; fieldId: string; productId: string; productName?: string;
  activeSubstanceCodes: string[]; resistanceGroups: ResistanceGroupUse[]; doseValue: number;
  doseUnit: string; treatedAreaHa: number; appliedAt: string;
}
