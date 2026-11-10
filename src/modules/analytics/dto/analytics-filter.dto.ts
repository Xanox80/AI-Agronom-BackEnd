import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Min } from 'class-validator';

export class AnalyticsFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cropId?: string;
  @ApiPropertyOptional({ description: 'Catalogue diagnosis id' }) @IsOptional() @IsUUID() diagnosisId?: string;
  @ApiPropertyOptional({ description: 'ISO-8601 UTC, inclusive' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ description: 'ISO-8601 UTC, inclusive' }) @IsOptional() @IsISO8601() to?: string;
  @ApiPropertyOptional({ description: 'Season year; the season starts in the configured month. Overridden by from/to' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) season?: number;
}

export class ExportPageQueryDto {
  @ApiPropertyOptional({ description: 'Only rows changed after this ISO-8601 UTC instant' })
  @IsOptional() @IsISO8601() updatedSince?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
