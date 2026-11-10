import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';
import { UUID_VERSION } from '../observation.constants';

export class ConfirmObservationDto {
  @ApiProperty() @IsUUID(UUID_VERSION) diagnosisId: string;
  @ApiProperty() @IsBoolean() correctedFromModel: boolean;
}
