import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PullQueryDto {
  @ApiPropertyOptional({ description: 'Cursor: the serverTime of the previous pull; omit for a full pull' })
  @IsOptional() @IsDateString() since?: string;
  @ApiPropertyOptional({ description: 'nextCursor of the previous page; send it with the same since until nextCursor is absent' })
  @IsOptional() @IsString() @IsNotEmpty() cursor?: string;
  @ApiProperty() @IsString() @IsNotEmpty() deviceId: string;
}

export class StatusQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() deviceId: string;
}

export interface PullResponse {
  serverTime: string;
  changes: {
    fields: unknown[]; tasks: unknown[]; observations: unknown[];
    recommendations: unknown[]; diagnoses: unknown[]; treatments: unknown[];
  };
  deleted: Record<string, string[]>;
  /** Present while more rows remain; the final page's serverTime is the next `since`. */
  nextCursor?: string;
}

export interface SyncStatusResponse {
  pendingRefinement: number;
  lastPushAt?: string;
  lastPullAt?: string;
  catalogVersion: number;
  clientConfig?: { backoffBaseMs: number; backoffMaxMs: number; backoffFactor: number; batchSize: number };
}
