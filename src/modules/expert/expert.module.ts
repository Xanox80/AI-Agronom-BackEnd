import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CatalogChangeProposalEntity, CatalogDiagnosisEntity, CropEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity,
  ExpertCaseEntity, LabelEntity, ObservationEntity, PhotoEntity, UserEntity,
} from '../../domain/entities';
import { CaseEventListener } from './case-event.listener';
import { CasePriorityService } from './case-priority.service';
import { DatasetService } from './dataset.service';
import { EXPERT_CONFIG, buildExpertConfig } from './expert.config';
import { ExpertCaseQueryService } from './expert-case-query.service';
import { ExpertCaseService } from './expert-case.service';
import { ExpertController } from './expert.controller';
import { FeedbackController } from './feedback.controller';
import { LabelWeightService } from './label-weight.service';
import { LabelingService } from './labeling.service';
import { QualityMetricsService } from './quality-metrics.service';
import { RareClassService } from './rare-class.service';
import { UserFeedbackService } from './user-feedback.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    ExpertCaseEntity, LabelEntity, ObservationEntity, PhotoEntity, UserEntity, DiagnosisResultEntity, DiagnosisHypothesisEntity,
    CatalogDiagnosisEntity, CropEntity, CatalogChangeProposalEntity,
  ])],
  controllers: [ExpertController, FeedbackController],
  providers: [
    {
      provide: EXPERT_CONFIG, inject: [ConfigService],
      useFactory: (config: ConfigService) => buildExpertConfig(new Proxy({}, { get: (_, key) => config.get<string>(String(key)) })),
    },
    CasePriorityService, RareClassService, LabelWeightService, ExpertCaseService, ExpertCaseQueryService, UserFeedbackService,
    LabelingService, DatasetService, QualityMetricsService, CaseEventListener,
  ],
})
export class ExpertModule {}
