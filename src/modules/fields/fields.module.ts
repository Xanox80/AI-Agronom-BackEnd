import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CropEntity, FieldEntity, FieldCropMemoryEntity } from '../../domain/entities';
import { CropMemoryService } from './crop-memory.service';
import { DemoFieldsSeeder } from './demo-fields.seeder';
import { FieldGeometryService } from './field-geometry.service';
import { FieldImportService } from './field-import.service';
import { FieldLocatorService } from './field-locator.service';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';
import { FieldsSettings } from './fields.settings';
import { FIELD_IMPORTERS } from './import/field-importer';
import { GeoJsonImporter } from './import/geojson.importer';
import { KmlImporter } from './import/kml.importer';
import { ShapefileImporter } from './import/shapefile.importer';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldEntity, FieldCropMemoryEntity, CropEntity]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ limits: { fileSize: new FieldsSettings(config).importMaxBytes } }),
    }),
  ],
  controllers: [FieldsController],
  providers: [
    FieldsService, FieldImportService, FieldLocatorService, CropMemoryService, FieldGeometryService, FieldsSettings,
    GeoJsonImporter, KmlImporter, ShapefileImporter, DemoFieldsSeeder,
    {
      provide: FIELD_IMPORTERS,
      useFactory: (...importers: unknown[]) => importers,
      inject: [GeoJsonImporter, KmlImporter, ShapefileImporter],
    },
  ],
  exports: [FieldsService, FieldLocatorService, CropMemoryService],
})
export class FieldsModule {}
