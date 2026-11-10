import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORTED_LOCALES = ['uk', 'en'];

export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(1) password: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @MinLength(1) refreshToken: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) displayName?: string;
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES }) @IsOptional() @IsIn(SUPPORTED_LOCALES) locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() geoCollectionEnabled?: boolean;
}
