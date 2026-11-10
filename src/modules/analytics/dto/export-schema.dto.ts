import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import type { Geometry } from 'geojson';
import type {
  ExternalIds, FieldExportDto, ObservationExportDto, TaskExportDto, TreatmentExportDto,
} from '../../../domain/export/export.dto';
import { ExportPageDto } from './analytics-response.dto';

export class ExternalIdsSchema implements ExternalIds {
  @ApiProperty() scoutId: string;
  @ApiPropertyOptional({ description: 'Set once the record is linked in AP Agronomist' }) agronomistId?: string;
}

abstract class ExportBaseSchema {
  @ApiProperty({ enum: [1] }) schemaVersion: 1;
  @ApiProperty({ type: ExternalIdsSchema }) externalIds: ExternalIdsSchema;
  @ApiProperty({ description: 'ISO-8601 UTC' }) updatedAt: string;
}

const nullable = { nullable: true } as const;

export class FieldExportSchema extends ExportBaseSchema implements FieldExportDto {
  @ApiProperty() name: string;
  @ApiProperty() areaHa: number;
  @ApiProperty({ ...nullable, type: String }) cropCode: string | null;
  @ApiProperty({ ...nullable, type: String }) variety: string | null;
  @ApiProperty({ ...nullable, type: String, description: 'YYYY-MM-DD' }) sowingDate: string | null;
  @ApiProperty({ ...nullable, type: Object, description: 'GeoJSON geometry' }) geometry: Geometry | null;
}

export class ObservationExportSchema extends ExportBaseSchema implements ObservationExportDto {
  @ApiProperty({ ...nullable, type: String }) fieldScoutId: string | null;
  @ApiProperty({ ...nullable, type: String }) cropCode: string | null;
  @ApiProperty({ ...nullable, type: String }) diagnosisCode: string | null;
  @ApiProperty() confirmed: boolean;
  @ApiProperty({ ...nullable, type: Number }) bbchStage: number | null;
  @ApiProperty({ ...nullable, type: Number }) lat: number | null;
  @ApiProperty({ ...nullable, type: Number }) lng: number | null;
  @ApiProperty({ description: 'ISO-8601 UTC' }) capturedAt: string;
  @ApiProperty({ ...nullable, type: Number }) temperatureC: number | null;
  @ApiProperty({ ...nullable, type: Number }) humidityPct: number | null;
  @ApiProperty() userEmail: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ ...nullable, type: String }) textNote: string | null;
  @ApiProperty({ type: [String] }) photoUrls: string[];
}

export class TaskExportSchema extends ExportBaseSchema implements TaskExportDto {
  @ApiProperty() type: string;
  @ApiProperty() status: string;
  @ApiProperty() priority: string;
  @ApiProperty() title: string;
  @ApiProperty() notes: string;
  @ApiProperty() fieldScoutId: string;
  @ApiProperty({ ...nullable, type: String }) diagnosisCode: string | null;
  @ApiProperty({ ...nullable, type: Number }) lat: number | null;
  @ApiProperty({ ...nullable, type: Number }) lng: number | null;
  @ApiProperty({ ...nullable, type: String }) deadline: string | null;
  @ApiProperty({ ...nullable, type: String }) completedAt: string | null;
  @ApiProperty({ ...nullable, type: String }) assigneeEmail: string | null;
  @ApiProperty({ type: [String] }) photoUrls: string[];
}

export class TreatmentExportSchema extends ExportBaseSchema implements TreatmentExportDto {
  @ApiProperty() fieldScoutId: string;
  @ApiProperty({ ...nullable, type: String }) productRegistrationNumber: string | null;
  @ApiProperty() productName: string;
  @ApiProperty({ type: [String] }) activeSubstanceCodes: string[];
  @ApiProperty() doseValue: number;
  @ApiProperty() doseUnit: string;
  @ApiProperty() treatedAreaHa: number;
  @ApiProperty({ description: 'YYYY-MM-DD' }) appliedAt: string;
  @ApiProperty() recordedByEmail: string;
}

/** Documents a page response with its concrete item schema, which a generic ExportPageDto cannot express. */
export function ApiExportPage(item: Type<unknown>): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ExportPageDto, item),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ExportPageDto) },
          { properties: { items: { type: 'array', items: { $ref: getSchemaPath(item) } } } },
        ],
      },
    }),
  );
}
