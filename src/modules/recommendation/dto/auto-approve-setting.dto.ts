import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ProblemCategory } from '../../../domain/enums';

export class UpsertAutoApproveSettingDto {
  @ApiPropertyOptional({ enum: ProblemCategory }) @IsOptional() @IsEnum(ProblemCategory) problemCategory?: ProblemCategory;
  @ApiPropertyOptional() @IsOptional() @IsUUID() diagnosisId?: string;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) minConfidence: number;
  @ApiProperty() @IsBoolean() enabled: boolean;
}

export interface AutoApproveSettingDto {
  id: string; problemCategory: ProblemCategory | null; diagnosisId: string | null; minConfidence: number; enabled: boolean;
}
