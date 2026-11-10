import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsNotEmpty, IsObject, IsString, IsUUID, ValidateNested } from 'class-validator';
import { SyncEntityType, SyncOperation, SyncStatus } from '../../../domain/enums';

export class SyncItemDto {
  @ApiProperty({ enum: SyncEntityType }) @IsEnum(SyncEntityType) entityType: SyncEntityType;
  @ApiProperty() @IsUUID() clientId: string;
  @ApiProperty({ enum: SyncOperation }) @IsEnum(SyncOperation) operation: SyncOperation;
  @ApiProperty() @IsDateString() clientTimestamp: string;
  @ApiProperty({ description: 'Entity fields; validated per entityType' }) @IsObject() payload: Record<string, unknown>;
}

export class PushRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() deviceId: string;
  @ApiProperty({ type: [SyncItemDto] })
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => SyncItemDto)
  items: SyncItemDto[];
}

export class PushResultDto {
  @ApiProperty() clientId: string;
  @ApiProperty({ enum: SyncEntityType }) entityType: SyncEntityType;
  @ApiProperty({ enum: SyncStatus }) status: SyncStatus;
  @ApiPropertyOptional() serverId?: string;
  @ApiPropertyOptional() error?: string;
}

export class PushResponseDto {
  @ApiProperty({ type: [PushResultDto] }) results: PushResultDto[];
  @ApiProperty() serverTime: string;
}
