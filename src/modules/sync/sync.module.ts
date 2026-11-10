import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CatalogStateEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, FarmEntity, FieldEntity, ObservationEntity,
  PhotoEntity, RecommendationEntity, SyncRecordEntity, TaskEntity, TreatmentEntity, UserEntity,
} from '../../domain/entities';
import { DeletionTombstoneSubscriber } from './deletion-tombstone.subscriber';
import { ObservationEnricher } from './enrichment/observation-enricher';
import { FieldsModule } from '../fields/fields.module';
import { FieldGeometryService } from '../fields/field-geometry.service';
import { RecognitionModule } from '../recognition/recognition.module';
import { TasksModule } from '../tasks/tasks.module';
import { WeatherModule } from '../weather/weather.module';
import { EntitySyncHandler, SYNC_HANDLERS } from './handlers/entity-sync-handler';
import { FeedbackSyncHandler } from './handlers/feedback-sync.handler';
import { FieldSyncHandler } from './handlers/field-sync.handler';
import { ObservationSyncHandler } from './handlers/observation-sync.handler';
import { TaskSyncHandler } from './handlers/task-sync.handler';
import { TreatmentSyncHandler } from './handlers/treatment-sync.handler';
import { HealthController } from './health.controller';
import { OBSERVATION_REFINER } from './refinement/observation-refiner';
import { RecognitionObservationRefiner } from './refinement/recognition-observation-refiner';
import { RefinementQueueService } from './refinement/refinement-queue.service';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { SyncStatusService } from './sync-status.service';
import { SyncSettings } from './sync.settings';

const HANDLERS = [FieldSyncHandler, ObservationSyncHandler, TaskSyncHandler, TreatmentSyncHandler, FeedbackSyncHandler];

@Module({
  imports: [TypeOrmModule.forFeature([
    SyncRecordEntity, ObservationEntity, PhotoEntity, TaskEntity, TreatmentEntity, FieldEntity, DiagnosisResultEntity,
    DiagnosisHypothesisEntity, RecommendationEntity, FarmEntity, CatalogStateEntity, UserEntity,
  ]), FieldsModule, WeatherModule, TasksModule, RecognitionModule],
  controllers: [SyncController, HealthController],
  providers: [
    ...HANDLERS,
    // Order is the apply order inside a push: fields before the rows that reference them.
    { provide: SYNC_HANDLERS, useFactory: (...handlers: EntitySyncHandler[]) => handlers, inject: HANDLERS },
    { provide: OBSERVATION_REFINER, useClass: RecognitionObservationRefiner },
    FieldGeometryService, ObservationEnricher, SyncSettings, DeletionTombstoneSubscriber,
    RefinementQueueService, SyncPushService, SyncPullService, SyncStatusService,
  ],
})
export class SyncModule {}
