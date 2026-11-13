import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogDiagnosisEntity, CropEntity, ObservationEntity, PhotoEntity } from '../../../domain/entities';
import { ObservationsModule } from '../../observations/observations.module';
import { SimilarityModule } from '../similarity.module';
import { ConfirmedPhotoLearner } from './confirmed-photo-learner.service';
import { ReferencePhotoFiles } from './reference-photo-files.service';
import { RetrainScheduler } from './retrain-scheduler.service';
import { SimilarPhotosController } from './similar-photos.controller';

/** What the app feeds back into the reference base (confirmed photos, retraining) and serves from it (comparison photos). */
@Module({
  imports: [
    TypeOrmModule.forFeature([ObservationEntity, PhotoEntity, CatalogDiagnosisEntity, CropEntity]),
    SimilarityModule,
    ObservationsModule,
  ],
  controllers: [SimilarPhotosController],
  providers: [ConfirmedPhotoLearner, RetrainScheduler, ReferencePhotoFiles],
})
export class ReferenceFeedbackModule {}
