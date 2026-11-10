import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const BBCH_MIN = 0;
const BBCH_MAX = 99;
const PERCENT_MAX = 100;
const REJECTION_REASON_MAX_LENGTH = 1000;

export class CreateRecommendationDto {
  @ApiProperty() @IsUUID() observationId: string;
  @ApiPropertyOptional({ description: 'Confirmed or chosen hypothesis diagnosis id' }) @IsOptional() @IsUUID() diagnosisId?: string;
  @ApiPropertyOptional({ minimum: BBCH_MIN, maximum: BBCH_MAX }) @IsOptional() @IsInt() @Min(BBCH_MIN) @Max(BBCH_MAX) bbchStage?: number;
  @ApiPropertyOptional({ description: 'Measured share of leaf area or plants affected, %', minimum: 0, maximum: PERCENT_MAX }) @IsOptional() @IsNumber() @Min(0) @Max(PERCENT_MAX) damagePercent?: number;
}

export class RecomputeRecommendationDto {
  @ApiPropertyOptional({ minimum: BBCH_MIN, maximum: BBCH_MAX }) @IsOptional() @IsInt() @Min(BBCH_MIN) @Max(BBCH_MAX) bbchStage?: number;
  @ApiPropertyOptional({ description: 'Measured share of leaf area or plants affected, %', minimum: 0, maximum: PERCENT_MAX }) @IsOptional() @IsNumber() @Min(0) @Max(PERCENT_MAX) damagePercent?: number;
}

export class RejectRecommendationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(REJECTION_REASON_MAX_LENGTH) reason: string;
}
