import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SubmitAnswersDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { q_spots_halo: 'yes' } })
  @IsObject() answers: Record<string, string>;
}
