import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from './users.dto';

export class SafetyBuffersDto {
  @ApiPropertyOptional() @IsNumber() @Min(0) waterM: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) apiaryM: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) settlementM: number;
}

export class UpdateFarmDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) regionCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) timezone?: string;
  @ApiPropertyOptional({ type: SafetyBuffersDto }) @IsOptional() @ValidateNested() @Type(() => SafetyBuffersDto)
  defaultSafetyBuffers?: SafetyBuffersDto;
}

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
