import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { AppConfig } from '../../config/app-config';
import {
  CropEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldCropMemoryEntity, FieldEntity, ObservationEntity, PhotoEntity,
  VoiceNoteEntity,
} from '../../domain/entities';
import { FieldHistoryController } from './field-history.controller';
import { MediaFilesController } from './media-files.controller';
import { ObservationConfirmationService } from './observation-confirmation.service';
import { ObservationContextResolver } from './observation-context.resolver';
import { ObservationMediaService } from './observation-media.service';
import { ObservationStatusListener } from './observation-status.listener';
import { ObservationMapper } from './observation.mapper';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';
import { BYTES_PER_MB } from './observation.constants';
import { LocatorFieldDirectory } from './adapters/locator-field-directory';
import { WeatherServiceSnapshot } from './adapters/weather-service-snapshot';
import { FIELD_DIRECTORY } from './ports/field-directory.port';
import { WEATHER_SNAPSHOT } from './ports/weather-snapshot.port';
import { FieldsModule } from '../fields/fields.module';
import { WeatherModule } from '../weather/weather.module';
import { LocalPhotoStorage } from './storage/local-photo-storage';
import { PHOTO_STORAGE } from './storage/photo-storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ObservationEntity, PhotoEntity, VoiceNoteEntity, FieldCropMemoryEntity, FieldEntity, CropEntity, DiagnosisResultEntity,
      DiagnosisHypothesisEntity,
    ]),
    FieldsModule, WeatherModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { maxPhotoMb, maxVoiceMb } = config.get('storage', { infer: true });
        return { storage: memoryStorage(), limits: { fileSize: Math.max(maxPhotoMb, maxVoiceMb) * BYTES_PER_MB } };
      },
    }),
  ],
  controllers: [ObservationsController, MediaFilesController, FieldHistoryController],
  providers: [
    ObservationsService, ObservationConfirmationService, ObservationMediaService, ObservationContextResolver,
    ObservationMapper, ObservationStatusListener,
    { provide: PHOTO_STORAGE, useClass: LocalPhotoStorage },
    { provide: FIELD_DIRECTORY, useClass: LocatorFieldDirectory },
    { provide: WEATHER_SNAPSHOT, useClass: WeatherServiceSnapshot },
  ],
  exports: [ObservationsService, PHOTO_STORAGE],
})
export class ObservationsModule {}
