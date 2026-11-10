import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ExpertCaseReason, ExpertCaseStatus } from '../../../domain/enums';

export class ListCasesQuery {
  @ApiPropertyOptional({ enum: ExpertCaseStatus }) @IsOptional() @IsEnum(ExpertCaseStatus) status?: ExpertCaseStatus;
  @ApiPropertyOptional({ enum: ExpertCaseReason }) @IsOptional() @IsEnum(ExpertCaseReason) reason?: ExpertCaseReason;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cropId?: string;
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ description: 'Defaults and upper bound come from EXPERT_DEFAULT_PAGE_SIZE / EXPERT_MAX_PAGE_SIZE' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class DatasetExportQuery {
  @ApiPropertyOptional({ description: 'ISO date; only labels updated after it' }) @IsOptional() @IsDateString() since?: string;
}
