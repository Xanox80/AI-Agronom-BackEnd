import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/app-config';
import {
  CatalogDiagnosisEntity, CropEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity,
  ObservationEntity, PhotoEntity, ReferenceImageEntity,
} from '../../domain/entities';
import { SimilarityModule } from '../similarity/similarity.module';
import { VisionProviderModule } from '../vision-provider/vision-provider.module';
import { CalibrationService } from './calibration.service';
import { CatalogReader } from './catalog-reader.service';
import { DiagnosisPresenter } from './diagnosis-presenter.service';
import { DiagnosisStore } from './diagnosis-store.service';
import { MultiFrameAggregator } from './multi-frame-aggregator.service';
import { ObservationContextLoader } from './observation-context-loader.service';
import { RecognitionController } from './recognition.controller';
import { RECOGNITION_CONFIG, RECOGNITION_ENV_KEYS, buildRecognitionConfig } from './recognition.config';
import { RecognitionPipeline } from './recognition-pipeline.service';
import { RecognitionService } from './recognition.service';
import { UnsureEvaluator } from './unsure-evaluator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiagnosisResultEntity, DiagnosisHypothesisEntity, ObservationEntity, PhotoEntity, FieldEntity,
      CatalogDiagnosisEntity, ReferenceImageEntity, CropEntity,
    ]),
    VisionProviderModule,
    SimilarityModule,
  ],
  controllers: [RecognitionController],
  providers: [
    {
      provide: RECOGNITION_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => buildRecognitionConfig(
        {
          recognition: config.get('recognition', { infer: true }),
          storage: config.get('storage', { infer: true }),
          app: config.get('app', { infer: true }),
        } as AppConfig,
        Object.fromEntries(RECOGNITION_ENV_KEYS.map((key) => [key, config.get<string>(key as keyof AppConfig)])),
      ),
    },
    CalibrationService, MultiFrameAggregator, UnsureEvaluator, RecognitionPipeline, CatalogReader,
    ObservationContextLoader, DiagnosisStore, DiagnosisPresenter, RecognitionService,
  ],
  exports: [RecognitionService],
})
export class RecognitionModule {}
