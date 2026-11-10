import { BadRequestException, Injectable } from '@nestjs/common';
import type { Feature, FeatureCollection } from 'geojson';
import { FieldSource } from '../../../domain/enums';
import { extensionOf, FieldImporter, ImportedFeatures } from './field-importer';

const EXTENSIONS = ['geojson', 'json'];

@Injectable()
export class GeoJsonImporter implements FieldImporter {
  supports(fileName: string): boolean {
    return EXTENSIONS.includes(extensionOf(fileName));
  }

  async parse(content: Buffer): Promise<ImportedFeatures> {
    return { source: FieldSource.ImportGeojson, features: this.featuresOf(this.json(content)) };
  }

  private json(content: Buffer): { type?: string } {
    try {
      return JSON.parse(content.toString('utf8'));
    } catch {
      throw this.invalid();
    }
  }

  private featuresOf(json: { type?: string }): Feature[] {
    if (json.type === 'FeatureCollection') return (json as FeatureCollection).features ?? [];
    if (json.type === 'Feature') return [json as Feature];
    if (json.type) return [{ type: 'Feature', properties: {}, geometry: json as Feature['geometry'] }];
    throw this.invalid();
  }

  private invalid(): BadRequestException {
    return new BadRequestException({ code: 'IMPORT_PARSE_FAILED', message: ['file is not valid GeoJSON'] });
  }
}
