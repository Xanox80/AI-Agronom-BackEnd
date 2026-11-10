import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { TaskStatus, TaskType } from '../../../domain/enums';
import { TASK_STATUSES } from '../tasks.constants';

export class PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class TaskQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES }) @IsOptional() @IsIn(TASK_STATUSES) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional({ enum: TaskType }) @IsOptional() @IsEnum(TaskType) type?: TaskType;
}

export class TreatmentQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
