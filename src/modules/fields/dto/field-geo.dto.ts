import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBooleanString, IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';

export class LocateQueryDto {
  @ApiProperty() @Type(() => Number) @IsLatitude() lat: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() lng: number;
}

export class ImportQueryDto {
  @ApiPropertyOptional({ description: 'true returns the parsed fields without saving them' })
  @IsOptional() @IsBooleanString() dryRun?: string;
}

export class CropMemoryDto {
  @ApiProperty() @IsUUID('4') cropId: string;
}

export interface FieldMatch { fieldId: string; name: string }

export interface FieldCandidate extends FieldMatch { distanceM: number }

export interface LocateResult { matches: FieldMatch[]; nearby: FieldCandidate[] }

export interface ImportResult<T> { imported: T[]; skipped: { index: number; reason: string }[] }
