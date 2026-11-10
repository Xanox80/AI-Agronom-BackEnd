import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ObservationStatus } from '../../../domain/enums';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, UUID_VERSION } from '../observation.constants';

export class PageQuery {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE) pageSize: number = DEFAULT_PAGE_SIZE;
}

export class ListObservationsQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) cropId?: string;
  @ApiPropertyOptional({ enum: ObservationStatus }) @IsOptional() @IsEnum(ObservationStatus) status?: ObservationStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
