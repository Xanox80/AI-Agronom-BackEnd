import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';

const MAX_LAT = 90;
const MAX_LNG = 180;
const MAX_PERCENT = 100;

export class CoordinatesQueryDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(-MAX_LAT) @Max(MAX_LAT) lat!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(-MAX_LNG) @Max(MAX_LNG) lng!: number;
}

export class ForecastQueryDto extends CoordinatesQueryDto {
  @ApiPropertyOptional({ description: 'Hours to return; capped by WEATHER_HORIZON_HOURS' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) hours?: number;
}

export class SprayConstraintsDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxWindMs?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minTempC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxTempC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxRainMm?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) rainFreeHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(MAX_PERCENT) minHumidityPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(MAX_PERCENT) maxHumidityPct?: number;
}

export class WindowRequestDto extends CoordinatesQueryDto {
  @ApiPropertyOptional({ type: SprayConstraintsDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => SprayConstraintsDto) constraints?: SprayConstraintsDto;
}
