import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsIn, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested,
} from 'class-validator';
import { TaskPriority, TaskStatus, TaskType } from '../../../domain/enums';
import { CREATABLE_STATUSES, TASK_STATUSES } from '../tasks.constants';
import { TreatmentDetailsDto } from './treatment-input.dto';

export class CreateTaskDto {
  @ApiProperty() @IsUUID() clientId: string;
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
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
  @ApiPropertyOptional({ enum: CREATABLE_STATUSES }) @IsOptional() @IsIn(CREATABLE_STATUSES) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
}

export class UpdateTaskDto extends PartialType(
  PickType(CreateTaskDto, ['title', 'notes', 'priority', 'assigneeUserId', 'deadline', 'fieldId'] as const),
) {
  @ApiPropertyOptional({ enum: TASK_STATUSES }) @IsOptional() @IsIn(TASK_STATUSES) status?: TaskStatus;
}

export class CompleteTaskDto {
  @ApiPropertyOptional({ type: TreatmentDetailsDto })
  @IsOptional() @ValidateNested() @Type(() => TreatmentDetailsDto) treatment?: TreatmentDetailsDto;
}
