import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from './config/app-config';
import configuration from './config/configuration';
import { ALL_ENTITIES } from './domain/entities';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ExpertModule } from './modules/expert/expert.module';
import { FieldsModule } from './modules/fields/fields.module';
import { ObservationsModule } from './modules/observations/observations.module';
import { RecognitionModule } from './modules/recognition/recognition.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { ReferenceFeedbackModule } from './modules/similarity/feedback/reference-feedback.module';
import { StockModule } from './modules/stock/stock.module';
import { SyncModule } from './modules/sync/sync.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { VisionProviderModule } from './modules/vision-provider/vision-provider.module';
import { WeatherModule } from './modules/weather/weather.module';

const IN_MEMORY_DB = ':memory:';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { path, synchronize } = config.get('database', { infer: true });
        if (path !== IN_MEMORY_DB) mkdirSync(dirname(path), { recursive: true });
        return { type: 'better-sqlite3' as const, database: path, entities: ALL_ENTITIES, synchronize };
      },
    }),
    AuthModule, FieldsModule, ObservationsModule, VisionProviderModule, RecognitionModule, CatalogModule,
    WeatherModule, RecommendationModule, TasksModule, AnalyticsModule, SyncModule, ExpertModule, StockModule, ReferenceFeedbackModule,
  ],
})
export class AppModule {}
