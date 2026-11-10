import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProblemCategory, ProposalStatus } from '../../../domain/enums';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../catalog.constants';

export class DiagnosisQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cropId?: string;
  @ApiPropertyOptional({ enum: ProblemCategory }) @IsOptional() @IsEnum(ProblemCategory) category?: ProblemCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
}

export class ThresholdQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosisId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cropId?: string;
}

export class ProductQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cropId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosisId?: string;
  @ApiPropertyOptional({ description: 'Active substance code' }) @IsOptional() @IsString() activeSubstance?: string;
}

export class PackQueryDto {
  @ApiPropertyOptional({ description: 'Region code; defaults to CATALOG_DEFAULT_REGION' }) @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional({ description: 'Return only the delta after this catalogue version' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sinceVersion?: number;
}

export class ProposalQueryDto {
  @ApiPropertyOptional({ enum: ProposalStatus }) @IsOptional() @IsEnum(ProposalStatus) status?: ProposalStatus;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
