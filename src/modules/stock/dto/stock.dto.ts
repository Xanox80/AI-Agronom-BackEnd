import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { StockSource } from '../../../domain/enums';


export class UpsertStockDto {
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiProperty() @IsString() @IsNotEmpty() unit: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouse?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional({ example: '2027-01-31' }) @IsOptional() @IsDateString() expiresAt?: string;
}

export class StockQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class StockItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unit: string;
  @ApiPropertyOptional() warehouse?: string;
  @ApiPropertyOptional() lotNumber?: string;
  @ApiPropertyOptional() expiresAt?: string;
  @ApiProperty({ enum: StockSource }) source: StockSource;
  @ApiPropertyOptional() syncedAt?: string;
}

export class StockImportResultDto {
  @ApiProperty() upserted: number;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) skipped: { line: number; reason: string }[];
}
