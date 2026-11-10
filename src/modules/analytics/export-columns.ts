import type {
  ObservationExportDto, TaskExportDto, TreatmentExportDto,
} from '../../domain/export/export.dto';

type FlatColumns<T> = ReadonlyArray<Exclude<keyof T, 'externalIds'> | 'scoutId' | 'agronomistId'>;

/** Fixed CSV column sets, so an empty export still carries its header row. */
export const OBSERVATION_COLUMNS: FlatColumns<ObservationExportDto> = [
  'scoutId', 'agronomistId', 'schemaVersion', 'fieldScoutId', 'cropCode', 'diagnosisCode', 'confirmed', 'bbchStage',
  'lat', 'lng', 'capturedAt', 'temperatureC', 'humidityPct', 'userEmail', 'displayName', 'textNote', 'photoUrls', 'updatedAt',
];

export const TASK_COLUMNS: FlatColumns<TaskExportDto> = [
  'scoutId', 'agronomistId', 'schemaVersion', 'type', 'status', 'priority', 'title', 'notes', 'fieldScoutId',
  'diagnosisCode', 'lat', 'lng', 'deadline', 'completedAt', 'assigneeEmail', 'photoUrls', 'updatedAt',
];

export const TREATMENT_COLUMNS: FlatColumns<TreatmentExportDto> = [
  'scoutId', 'agronomistId', 'schemaVersion', 'fieldScoutId', 'productRegistrationNumber', 'productName',
  'activeSubstanceCodes', 'doseValue', 'doseUnit', 'treatedAreaHa', 'appliedAt', 'recordedByEmail', 'updatedAt',
];

