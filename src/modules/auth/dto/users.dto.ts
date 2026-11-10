import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Role } from '../../../domain/enums';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PASSWORD_MIN_LENGTH } from '../auth.constants';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH }) @IsString() @MinLength(PASSWORD_MIN_LENGTH) password: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) displayName: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role;
  @ApiPropertyOptional() @IsOptional() @IsString() regionCode?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) displayName?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() geoCollectionEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) trustWeight?: number;
  @ApiPropertyOptional({ minLength: PASSWORD_MIN_LENGTH }) @IsOptional() @IsString() @MinLength(PASSWORD_MIN_LENGTH) password?: string;
}
