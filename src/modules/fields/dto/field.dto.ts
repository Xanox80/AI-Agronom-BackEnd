import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { Geometry } from 'geojson';
import { FieldSource } from '../../../domain/enums';

export class CreateFieldDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') clientId?: string;
  @ApiPropertyOptional() @IsString() name: string;
  @ApiPropertyOptional({ description: 'Manual area; ignored when a contour is present' })
  @IsOptional() @IsNumber() @Min(0) areaHa?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') cropId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() variety?: string;
  @ApiPropertyOptional({ example: '2026-04-15' }) @IsOptional() @IsDateString() sowingDate?: string;
  @ApiPropertyOptional({ description: 'GeoJSON Polygon or MultiPolygon (WGS84)' }) @IsOptional() @IsObject() contour?: Geometry;
  @ApiPropertyOptional({ enum: FieldSource }) @IsOptional() @IsEnum(FieldSource) source?: FieldSource;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearWater?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearApiary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() nearSettlement?: boolean;
}

export class UpdateFieldDto extends PartialType(CreateFieldDto) {}

export class ListFieldsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') cropId?: string;
  @ApiPropertyOptional({ description: 'Defaults to 1' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ description: 'Defaults to FIELDS_DEFAULT_PAGE_SIZE, capped at FIELDS_MAX_PAGE_SIZE' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
