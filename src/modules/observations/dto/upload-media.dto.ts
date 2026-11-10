import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import type { QualityReport } from '../../../domain/types';
import { UUID_VERSION } from '../observation.constants';

const parseJson = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export class UploadPhotoDto {
  @ApiProperty({ type: 'string', format: 'binary' }) file?: unknown;
  @ApiProperty() @IsUUID(UUID_VERSION) clientId: string;
  @ApiProperty({ description: '1..MAX_PHOTOS_PER_OBSERVATION' }) @Type(() => Number) @IsInt() @Min(1) seq: number;
  @ApiPropertyOptional({ description: 'JSON string of the on-device quality report' })
  @IsOptional() @Transform(parseJson) @IsObject() qualityReport?: QualityReport;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) widthPx?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) heightPx?: number;
}

export class UploadVoiceNoteDto {
  @ApiProperty({ type: 'string', format: 'binary' }) file?: unknown;
  @ApiProperty() @IsUUID(UUID_VERSION) clientId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) durationSec: number;
}
