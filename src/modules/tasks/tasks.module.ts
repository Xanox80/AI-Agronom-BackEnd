import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ActiveSubstanceEntity, CatalogDiagnosisEntity, FieldEntity, ProductActiveSubstanceEntity, ProductEntity, TaskEntity,
  TreatmentEntity, UserEntity, ObservationEntity, RecommendationEntity, PhotoEntity,
} from '../../domain/entities';
import { FieldAccess } from './field-access';
import { TaskPresenter } from './task-presenter';
import { TaskReferences } from './task-references';
import { TasksSettings } from './tasks.settings';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    TaskEntity, TreatmentEntity, FieldEntity, CatalogDiagnosisEntity, UserEntity, ProductEntity,
    ProductActiveSubstanceEntity, ActiveSubstanceEntity, ObservationEntity, RecommendationEntity, PhotoEntity,
  ])],
  controllers: [TasksController, TreatmentsController],
  providers: [TasksService, TreatmentsService, TaskPresenter, FieldAccess, TaskReferences, TasksSettings],
  exports: [TreatmentsService, FieldAccess, TaskReferences],
})
export class TasksModule {}
