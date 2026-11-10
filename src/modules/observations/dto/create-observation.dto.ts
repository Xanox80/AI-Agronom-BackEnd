import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { Organ } from '../../../domain/enums';
import { BBCH_MAX, DEVICE_MODEL_MAX_LENGTH, TEXT_NOTE_MAX_LENGTH, UUID_VERSION } from '../observation.constants';

export class CreateObservationDto {
  @ApiProperty({ description: 'Device-generated UUID; makes the call idempotent' })
  @IsUUID(UUID_VERSION) clientId: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() clientCreatedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) cropId?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: BBCH_MAX }) @IsOptional() @IsInt() @Min(0) @Max(BBCH_MAX) bbchStage?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) gpsAccuracyM?: number;
  @ApiProperty() @IsDateString() capturedAt: string;
  @ApiPropertyOptional({ description: 'Defaults to the request User-Agent' })
  @IsOptional() @IsString() @MaxLength(DEVICE_MODEL_MAX_LENGTH) deviceModel?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperatureC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) humidityPct?: number;
  @ApiPropertyOptional({ enum: Organ }) @IsOptional() @IsEnum(Organ) organ?: Organ;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(TEXT_NOTE_MAX_LENGTH) textNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() scaleMarkerUsed?: boolean;
  @ApiPropertyOptional({ description: 'Quick capture without diagnosis; always true for the mechanic role' })
  @IsOptional() @IsBoolean() isQuickCapture?: boolean;
}
