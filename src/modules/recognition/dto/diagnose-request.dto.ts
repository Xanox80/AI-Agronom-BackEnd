import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Locale, SUPPORTED_LOCALES } from '../recognition.constants';

export class DiagnoseRequestDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, description: 'Language of evidence text; defaults to the configured locale' })
  @IsOptional() @IsIn(SUPPORTED_LOCALES) locale?: Locale;
}
