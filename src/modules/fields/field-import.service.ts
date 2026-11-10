import { randomUUID } from 'crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Feature, Geometry } from 'geojson';
import { FieldSource } from '../../domain/enums';
import type { FieldDto } from '../../domain/types';
import { ImportResult } from './dto/field-geo.dto';
import { FieldGeometryService } from './field-geometry.service';
import { FIELD_IMPORTERS, FieldImporter } from './import/field-importer';
import { FieldsService } from './fields.service';
import { FieldsSettings } from './fields.settings';

const NAME_PROPERTIES = ['name', 'Name', 'NAME', 'title', 'label'];

@Injectable()
export class FieldImportService {
  constructor(
    @Inject(FIELD_IMPORTERS) private readonly importers: FieldImporter[],
    private readonly geometry: FieldGeometryService,
    private readonly fields: FieldsService,
    private readonly settings: FieldsSettings,
  ) {}

  async import(farmId: string, fileName: string, content: Buffer, dryRun: boolean, userId?: string): Promise<ImportResult<FieldDto>> {
    const importer = this.importers.find((candidate) => candidate.supports(fileName));
    if (!importer) {
      throw new BadRequestException({ code: 'IMPORT_FORMAT_UNSUPPORTED', message: ['supported formats: .kml, .geojson, .json, .zip (shapefile)'] });
    }
    const { source, features } = await importer.parse(content);
    const result: ImportResult<FieldDto> = { imported: [], skipped: [] };
    for (const [index, feature] of features.entries()) {
      if (!this.geometry.isPolygonal(feature?.geometry)) {
        result.skipped.push({ index, reason: 'geometry is not a polygon' });
        continue;
      }
      const name = this.nameOf(feature, index);
      if (name.length > this.settings.nameMaxLength) {
        result.skipped.push({ index, reason: 'name is too long' });
        continue;
      }
      result.imported.push(await this.importOne(farmId, { name, contour: feature.geometry, source }, dryRun, userId));
    }
    return result;
  }

  private async importOne(farmId: string, input: { name: string; contour: Geometry; source: FieldSource }, dryRun: boolean, userId?: string): Promise<FieldDto> {
    if (!dryRun) return this.fields.create(farmId, input, userId);
    const shape = this.geometry.describe(input.contour);
    return {
      id: randomUUID(), name: input.name, areaHa: shape.areaHa, contour: shape.contour, centroid: shape.centroid,
      source: input.source, nearWater: false, nearApiary: false, nearSettlement: false,
    };
  }

  private nameOf(feature: Feature, index: number): string {
    const properties = feature.properties ?? {};
    const key = NAME_PROPERTIES.find((candidate) => typeof properties[candidate] === 'string' && properties[candidate].trim());
    return key ? String(properties[key]).trim() : `${this.settings.importFallbackName} ${index + 1}`;
  }
}
