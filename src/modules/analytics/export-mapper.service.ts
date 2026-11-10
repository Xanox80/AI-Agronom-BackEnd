import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { FieldEntity, ObservationEntity, TaskEntity, TreatmentEntity } from '../../domain/entities';
import {
  EXPORT_SCHEMA_VERSION, FieldExportDto, ObservationExportDto, TaskExportDto, TreatmentExportDto,
} from '../../domain/export/export.dto';
import { ExportLookup } from './export-lookup.service';
import { ObservationDiagnosisResolver } from './observation-diagnosis.resolver';

const base = (id: string) => ({ schemaVersion: EXPORT_SCHEMA_VERSION, externalIds: { scoutId: id } });
const iso = (date: Date | string): string => new Date(date).toISOString();
const isoOrNull = (date: Date | string | null): string | null => (date ? iso(date) : null);

/** Entities are never serialised directly: these mappers build the versioned export DTOs. */
@Injectable()
export class ExportMapper {
  private readonly apiPrefix: string;

  constructor(
    private readonly lookup: ExportLookup,
    private readonly diagnoses: ObservationDiagnosisResolver,
    config: ConfigService<AppConfig, true>,
  ) {
    this.apiPrefix = config.get('app', { infer: true }).apiPrefix;
  }

  async fields(rows: FieldEntity[]): Promise<FieldExportDto[]> {
    const cropCodes = await this.lookup.cropCodes();
    return rows.map((field) => ({
      ...base(field.id),
      name: field.name,
      areaHa: field.areaHa,
      cropCode: (field.cropId && cropCodes.get(field.cropId)) || null,
      variety: field.variety,
      sowingDate: field.sowingDate,
      geometry: field.contour,
      updatedAt: iso(field.updatedAt),
    }));
  }

  async observations(farmId: string, rows: ObservationEntity[]): Promise<ObservationExportDto[]> {
    const [cropCodes, diagnoses, users, photos] = await Promise.all([
      this.lookup.cropCodes(),
      this.diagnoses.resolve(rows),
      this.lookup.userIdentities(farmId, unique(rows.map((row) => row.userId))),
      this.lookup.photoIdsByObservation(farmId, rows.map((row) => row.id)),
    ]);
    return rows.map((observation) => ({
      ...base(observation.id),
      fieldScoutId: observation.fieldId,
      cropCode: (observation.cropId && cropCodes.get(observation.cropId)) || null,
      diagnosisCode: diagnoses.get(observation.id)?.code ?? null,
      confirmed: observation.confirmedDiagnosisId !== null,
      bbchStage: observation.bbchStage,
      lat: observation.lat,
      lng: observation.lng,
      capturedAt: iso(observation.capturedAt),
      temperatureC: observation.temperatureC,
      humidityPct: observation.humidityPct,
      userEmail: users.get(observation.userId)?.email ?? '',
      displayName: users.get(observation.userId)?.displayName ?? '',
      textNote: observation.textNote,
      photoUrls: (photos.get(observation.id) ?? []).map((id) => this.photoUrl(id)),
      updatedAt: iso(observation.updatedAt),
    }));
  }

  async tasks(farmId: string, rows: TaskEntity[]): Promise<TaskExportDto[]> {
    const [diagnosisCodes, users] = await Promise.all([
      this.lookup.diagnosisCodes(),
      this.lookup.userIdentities(farmId, unique(rows.flatMap((row) => (row.assigneeUserId ? [row.assigneeUserId] : [])))),
    ]);
    return rows.map((task) => ({
      ...base(task.id),
      type: task.type,
      status: task.status,
      priority: task.priority,
      title: task.title,
      notes: task.notes,
      fieldScoutId: task.fieldId,
      diagnosisCode: (task.diagnosisId && diagnosisCodes.get(task.diagnosisId)) || null,
      lat: task.lat,
      lng: task.lng,
      deadline: isoOrNull(task.deadline),
      completedAt: isoOrNull(task.completedAt),
      assigneeEmail: (task.assigneeUserId && users.get(task.assigneeUserId)?.email) || null,
      photoUrls: task.photoIds.map((id) => this.photoUrl(id)),
      updatedAt: iso(task.updatedAt),
    }));
  }

  async treatments(farmId: string, rows: TreatmentEntity[]): Promise<TreatmentExportDto[]> {
    const [products, users] = await Promise.all([
      this.lookup.productsById(unique(rows.map((row) => row.productId))),
      this.lookup.userIdentities(farmId, unique(rows.map((row) => row.recordedByUserId))),
    ]);
    return rows.map((treatment) => ({
      ...base(treatment.id),
      fieldScoutId: treatment.fieldId,
      productRegistrationNumber: products.get(treatment.productId)?.registrationNumber ?? null,
      productName: products.get(treatment.productId)?.name ?? '',
      activeSubstanceCodes: treatment.activeSubstanceCodes,
      doseValue: treatment.doseValue,
      doseUnit: treatment.doseUnit,
      treatedAreaHa: treatment.treatedAreaHa,
      appliedAt: treatment.appliedAt,
      recordedByEmail: users.get(treatment.recordedByUserId)?.email ?? '',
      updatedAt: iso(treatment.updatedAt),
    }));
  }

  private photoUrl(photoId: string): string {
    return `/${this.apiPrefix}/photos/${photoId}/file`;
  }
}

const unique = (ids: string[]): string[] => [...new Set(ids)];
