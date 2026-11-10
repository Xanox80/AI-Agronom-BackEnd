import type { Geometry } from 'geojson';

export interface ExternalIds { scoutId: string; agronomistId?: string }

interface ExportBase { schemaVersion: 1; externalIds: ExternalIds }

export interface FieldExportDto extends ExportBase {
  name: string; areaHa: number; cropCode: string | null; variety: string | null; sowingDate: string | null;
  geometry: Geometry | null; updatedAt: string;
}

export interface ObservationExportDto extends ExportBase {
  fieldScoutId: string | null; cropCode: string | null; diagnosisCode: string | null; confirmed: boolean;
  bbchStage: number | null; lat: number | null; lng: number | null; capturedAt: string;
  temperatureC: number | null; humidityPct: number | null; userEmail: string; displayName: string;
  textNote: string | null; photoUrls: string[]; updatedAt: string;
}

export interface TaskExportDto extends ExportBase {
  type: string; status: string; priority: string; title: string; notes: string; fieldScoutId: string;
  diagnosisCode: string | null; lat: number | null; lng: number | null; deadline: string | null;
  completedAt: string | null; assigneeEmail: string | null; photoUrls: string[]; updatedAt: string;
}

export interface TreatmentExportDto extends ExportBase {
  fieldScoutId: string; productRegistrationNumber: string | null; productName: string;
  activeSubstanceCodes: string[]; doseValue: number; doseUnit: string; treatedAreaHa: number;
  appliedAt: string; recordedByEmail: string; updatedAt: string;
}

export const EXPORT_SCHEMA_VERSION = 1 as const;
