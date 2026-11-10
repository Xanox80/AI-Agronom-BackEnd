import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CatalogDiagnosisEntity, CropEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity,
  ObservationEntity, PhotoEntity, ProductEntity, TaskEntity, TreatmentEntity, UserEntity,
} from '../../domain/entities';
import { AnalyticsSettings } from './analytics.settings';
import { AnalyticsController } from './analytics.controller';
import { ExportApiController } from './export-api.controller';
import { ExportLookup } from './export-lookup.service';
import { ExportMapper } from './export-mapper.service';
import { ExportService } from './export.service';
import { FileExportController } from './file-export.controller';
import { HeatmapService } from './heatmap.service';
import { ObservationDiagnosisResolver } from './observation-diagnosis.resolver';
import { ObservationSelector } from './observation-selector.service';
import { SummaryService } from './summary.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    ObservationEntity, FieldEntity, TaskEntity, TreatmentEntity, CatalogDiagnosisEntity, DiagnosisResultEntity,
    DiagnosisHypothesisEntity, CropEntity, UserEntity, ProductEntity, PhotoEntity,
  ])],
  controllers: [AnalyticsController, FileExportController, ExportApiController],
  providers: [
    AnalyticsSettings, ObservationDiagnosisResolver, ObservationSelector, HeatmapService, SummaryService,
    ExportLookup, ExportMapper, ExportService,
  ],
})
export class AnalyticsModule {}
