import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CropEntity, BbchStageEntity, CatalogDiagnosisEntity, ThresholdEntity, ActiveSubstanceEntity, ProductEntity, ProductActiveSubstanceEntity, ProductRegistrationEntity, ReferenceImageEntity, CatalogChangeProposalEntity, CatalogStateEntity } from '../../domain/entities';
import { CatalogPackService } from './catalog-pack.service';
import { CatalogProposalService } from './catalog-proposal.service';
import { CatalogProposalsController } from './catalog-proposals.controller';
import { CatalogSeedService } from './catalog-seed.service';
import { CatalogStatusService } from './catalog-status.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProposalPayloadValidator } from './proposal-payload.validator';
import { ReferenceImageFileService } from './reference-image-file.service';

@Module({
  imports: [TypeOrmModule.forFeature([CropEntity, BbchStageEntity, CatalogDiagnosisEntity, ThresholdEntity, ActiveSubstanceEntity, ProductEntity, ProductActiveSubstanceEntity, ProductRegistrationEntity, ReferenceImageEntity, CatalogChangeProposalEntity, CatalogStateEntity])],
  controllers: [CatalogController, CatalogProposalsController],
  providers: [CatalogService, CatalogStatusService, CatalogPackService, CatalogProposalService, CatalogSeedService, ReferenceImageFileService, ProposalPayloadValidator],
  exports: [CatalogService, CatalogStatusService, CatalogPackService],
})
export class CatalogModule {}
