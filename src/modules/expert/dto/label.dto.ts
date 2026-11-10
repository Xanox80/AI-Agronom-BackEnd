import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';
import { LabelAction, ProblemCategory } from '../../../domain/enums';

export class RegionPointDto {
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) x: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) y: number;
}

export class AffectedRegionDto {
  @ApiProperty({ enum: ['rect', 'polygon'] }) @IsIn(['rect', 'polygon']) type: 'rect' | 'polygon';
  @ApiProperty({ type: [RegionPointDto] }) @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RegionPointDto)
  points: RegionPointDto[];
  @ApiProperty() @IsInt() @Min(1) photoSeq: number;
}

export class NewClassDto {
  @ApiProperty() @IsString() @IsNotEmpty() code: string;
  @ApiProperty() @IsString() @IsNotEmpty() nameUk: string;
  @ApiProperty() @IsString() @IsNotEmpty() nameEn: string;
  @ApiProperty({ enum: ProblemCategory }) @IsEnum(ProblemCategory) problemCategory: ProblemCategory;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) cropIds: string[];
}

export class CreateLabelDto {
  @ApiProperty({ enum: LabelAction }) @IsEnum(LabelAction) action: LabelAction;
  @ApiPropertyOptional() @IsOptional() @IsUUID() diagnosisId?: string;
  @ApiPropertyOptional({ type: NewClassDto }) @IsOptional() @ValidateNested() @Type(() => NewClassDto) newClass?: NewClassDto;
  @ApiPropertyOptional({ type: AffectedRegionDto }) @IsOptional() @ValidateNested() @Type(() => AffectedRegionDto)
  affectedRegion?: AffectedRegionDto;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class ResolveCaseDto {
  @ApiProperty() @IsUUID() finalDiagnosisId: string;
}

export class FeedbackDto {
  @ApiProperty() @IsUUID() observationId: string;
  @ApiProperty() @IsUUID() clientId: string;
  @ApiProperty() @IsUUID() finalDiagnosisId: string;
  @ApiProperty() @IsIn([true, false]) correctedFromModel: boolean;
}
