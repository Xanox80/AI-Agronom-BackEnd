import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/app-config';
import {
  ActiveSubstanceEntity, AutoApproveSettingEntity, CatalogDiagnosisEntity, CatalogStateEntity, CropEntity,
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FarmEntity, FieldEntity, ObservationEntity, ProductActiveSubstanceEntity,
  ProductEntity, ProductRegistrationEntity, RecommendationEntity, RecommendationItemEntity, ThresholdEntity,
  TreatmentEntity, UserEntity,
} from '../../domain/entities';
import { StockModule } from '../stock/stock.module';
import { WeatherModule } from '../weather/weather.module';
import { AutoApproveController } from './auto-approve.controller';
import { AutoApproveService } from './auto-approve.service';
import { CatalogReader } from './catalog.reader';
import { ActionLevelStep } from './pipeline/action-level.step';
import { AllowedProductsStep } from './pipeline/allowed-products.step';
import { ExplanationBuilder } from './pipeline/explanation.builder';
import { FilterStep } from './pipeline/filter.step';
import { RankStep } from './pipeline/rank.step';
import { RecommendationPipeline } from './pipeline/recommendation-pipeline';
import { ApplicationCountRule } from './pipeline/rules/application-count.rule';
import { BbchWindowRule } from './pipeline/rules/bbch-window.rule';
import { CompatibilityRule } from './pipeline/rules/compatibility.rule';
import { MinIntervalRule } from './pipeline/rules/min-interval.rule';
import { PreHarvestIntervalRule } from './pipeline/rules/pre-harvest-interval.rule';
import { RotationRule } from './pipeline/rules/rotation.rule';
import { SafetyWeatherStep } from './pipeline/safety-weather.step';
import { RecommendationAssembler } from './recommendation.assembler';
import { RecommendationController } from './recommendation.controller';
import { RecommendationInputLoader } from './recommendation-input.loader';
import { RecommendationMapper } from './recommendation.mapper';
import { RecommendationService } from './recommendation.service';
import { RECOMMENDATION_SETTINGS, readRecommendationSettings } from './recommendation.settings';

@Module({
  imports: [StockModule, WeatherModule, TypeOrmModule.forFeature([
    RecommendationEntity, RecommendationItemEntity, AutoApproveSettingEntity, UserEntity, FarmEntity,
    FieldEntity, ObservationEntity, DiagnosisResultEntity, DiagnosisHypothesisEntity, TreatmentEntity,
    CropEntity, CatalogDiagnosisEntity, ThresholdEntity, ProductEntity, ProductActiveSubstanceEntity, ActiveSubstanceEntity,
    ProductRegistrationEntity, CatalogStateEntity,
  ])],
  controllers: [RecommendationController, AutoApproveController],
  providers: [
    { provide: RECOMMENDATION_SETTINGS, inject: [ConfigService], useFactory: (config: ConfigService<AppConfig, true>) => readRecommendationSettings(config) },
    CatalogReader, RecommendationInputLoader, RecommendationMapper, RecommendationAssembler,
    RecommendationService, AutoApproveService, ExplanationBuilder, RecommendationPipeline,
    ActionLevelStep, AllowedProductsStep, FilterStep, SafetyWeatherStep, RankStep,
    BbchWindowRule, PreHarvestIntervalRule, ApplicationCountRule, MinIntervalRule, CompatibilityRule, RotationRule,
  ],
  exports: [RecommendationService],
})
export class RecommendationModule {}
