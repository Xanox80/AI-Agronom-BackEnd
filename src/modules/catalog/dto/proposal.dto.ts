import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ProposalEntityType, ProposalOperation, ProposalStatus } from '../../../domain/enums';

export class CreateProposalDto {
  @ApiProperty({ enum: ProposalEntityType }) @IsEnum(ProposalEntityType) entityType: ProposalEntityType;
  @ApiPropertyOptional({ description: 'Null for create' }) @IsOptional() @IsString() entityId?: string;
  @ApiProperty({ enum: ProposalOperation }) @IsEnum(ProposalOperation) operation: ProposalOperation;
  @ApiProperty({ description: 'Column values of the proposed row (ignored for delete)' }) @IsObject() payload: Record<string, unknown>;
}

export class ApproveProposalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class RejectProposalDto {
  @ApiProperty() @IsString() @IsNotEmpty() comment: string;
}

export class VerifyCatalogDto {
  @ApiProperty() @IsString() @IsNotEmpty() regionCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class ReferenceImageUploadDto {
  @ApiProperty() @IsString() @IsNotEmpty() diagnosisId: string;
  @ApiProperty() @IsString() @IsNotEmpty() caption: string;
  @ApiProperty() @IsString() @IsNotEmpty() attribution: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stage?: string;
}

export interface ProposalDto {
  id: string; entityType: ProposalEntityType; entityId: string | null; operation: ProposalOperation;
  payload: Record<string, unknown>; status: ProposalStatus; proposedByUserId: string;
  reviewedByUserId: string | null; reviewedAt: string | null; reviewComment: string | null; createdAt: string;
}

export interface CatalogActor { id: string; role: string }
