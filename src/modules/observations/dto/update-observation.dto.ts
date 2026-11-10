import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Organ } from '../../../domain/enums';
import { BBCH_MAX, TEXT_NOTE_MAX_LENGTH, UUID_VERSION } from '../observation.constants';

export class UpdateObservationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) fieldId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID(UUID_VERSION) cropId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(BBCH_MAX) bbchStage?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(TEXT_NOTE_MAX_LENGTH) textNote?: string;
  @ApiPropertyOptional({ enum: Organ }) @IsOptional() @IsEnum(Organ) organ?: Organ;
}
