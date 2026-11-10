import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class TreatmentDetailsDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsNumber() @IsPositive() doseValue: number;
  @ApiProperty({ example: 'l/ha' }) @IsString() @IsNotEmpty() doseUnit: string;
  @ApiProperty() @IsNumber() @IsPositive() treatedAreaHa: number;
  @ApiProperty({ example: '2026-06-01' }) @IsDateString() appliedAt: string;
}

export class CreateTreatmentDto extends TreatmentDetailsDto {
  @ApiProperty() @IsUUID() clientId: string;
  @ApiProperty() @IsUUID() fieldId: string;
}
