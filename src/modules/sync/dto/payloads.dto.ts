import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsObject,
  IsOptional, IsPositive, IsString, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';
import { FieldLinkMethod, FieldSource, Organ, TaskPriority, TaskStatus, TaskType } from '../../../domain/enums';

const MAX_BBCH = 99;
const MAX_PERCENT = 100;

export class ObservationPayloadDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() fieldId?: string;
  @ApiPropertyOptional({ enum: FieldLinkMethod }) @IsOptional() @IsEnum(FieldLinkMethod) fieldLinkMethod?: FieldLinkMethod;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cropId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(MAX_BBCH) bbchStage?: number;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) gpsAccuracyM?: number;
  @ApiProperty() @IsDateString() capturedAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceModel?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperatureC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(MAX_PERCENT) humidityPct?: number;
  @ApiPropertyOptional({ enum: Organ }) @IsOptional() @IsEnum(Organ) organ?: Organ;
  @ApiPropertyOptional() @IsOptional() @IsString() textNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() scaleMarkerUsed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isQuickCapture?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
}

export class TaskPayloadDto {
  @ApiProperty({ enum: TaskType }) @IsEnum(TaskType) type: TaskType;
  @ApiProperty() @IsUUID() fieldId: string;
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() observationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() diagnosisId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() recommendationId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) photoIds?: string[];
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
}

export class ResistanceGroupPayloadDto {
  @ApiProperty() @IsString() @IsNotEmpty() system: string;
  @ApiProperty() @IsString() @IsNotEmpty() group: string;
}

export class TreatmentPayloadDto {
  @ApiProperty() @IsUUID() fieldId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() taskId?: string;
  @ApiProperty() @IsUUID() productId: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) activeSubstanceCodes?: string[];
  @ApiPropertyOptional({ type: [ResistanceGroupPayloadDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ResistanceGroupPayloadDto)
  resistanceGroups?: ResistanceGroupPayloadDto[];
  @ApiProperty() @IsNumber() @IsPositive() doseValue: number;
  @ApiProperty() @IsString() @IsNotEmpty() doseUnit: string;
  @ApiProperty() @IsNumber() @IsPositive() treatedAreaHa: number;
  @ApiProperty({ description: 'Date only, YYYY-MM-DD' }) @IsDateString() appliedAt: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
}

export class FieldPayloadDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) areaHa?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cropId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() variety?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() sowingDate?: string;
  @ApiPropertyOptional({ description: 'GeoJSON Polygon or MultiPolygon' }) @IsOptional() @IsObject() contour?: Record<string, unknown>;
  @ApiPropertyOptional({ enum: FieldSource }) @IsOptional() @IsEnum(FieldSource) source?: FieldSource;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearWater?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearApiary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearSettlement?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
}

export class FeedbackPayloadDto {
  @ApiProperty() @IsUUID() observationId: string;
  @ApiProperty() @IsUUID() finalDiagnosisId: string;
  @ApiProperty() @IsBoolean() correctedFromModel: boolean;
}
