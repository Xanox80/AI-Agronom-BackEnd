import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import type { Feature, FeatureCollection } from 'geojson';
import { FieldSource } from '../../../domain/enums';
import { FieldsSettings } from '../fields.settings';
import { extensionOf, FieldImporter, ImportedFeatures } from './field-importer';
import { declaredUncompressedBytes } from './zip-size';

export type ZipParser = (content: Buffer) => Promise<FeatureCollection | FeatureCollection[]>;

export const ZIP_PARSER = Symbol('ZIP_PARSER');

/** shpjs ships an ESM-only build that needs `self` in Node, so it is loaded through a native dynamic import. */
export const loadShpjsZipParser: ZipParser = async (content) => {
  const scope = globalThis as { self?: unknown };
  const shimmed = scope.self === undefined;
  if (shimmed) scope.self = globalThis;
  try {
    const nativeImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<{ parseZip: ZipParser }>;
    const shp = await nativeImport('shpjs');
    const bytes = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
    return await shp.parseZip(bytes as unknown as Buffer);
  } finally {
    if (shimmed) delete scope.self;
  }
};

@Injectable()
export class ShapefileImporter implements FieldImporter {
  private readonly parseZip: ZipParser;

  constructor(private readonly settings: FieldsSettings, @Optional() @Inject(ZIP_PARSER) parseZip?: ZipParser) {
    this.parseZip = parseZip ?? loadShpjsZipParser;
  }

  supports(fileName: string): boolean {
    return extensionOf(fileName) === 'zip';
  }

  async parse(content: Buffer): Promise<ImportedFeatures> {
    this.assertUnzippedSizeAllowed(content);
    try {
      const parsed = await this.parseZip(content);
      const collections = Array.isArray(parsed) ? parsed : [parsed];
      const features: Feature[] = collections.flatMap((collection) => collection.features);
      return { source: FieldSource.ImportShp, features };
    } catch {
      throw new BadRequestException({ code: 'IMPORT_PARSE_FAILED', message: ['file is not a valid zipped shapefile'] });
    }
  }

  private assertUnzippedSizeAllowed(content: Buffer): void {
    const declared = declaredUncompressedBytes(content);
    if (Number.isNaN(declared)) {
      throw new BadRequestException({ code: 'IMPORT_PARSE_FAILED', message: ['file is not a valid zipped shapefile'] });
    }
    if (declared > this.settings.importMaxUnzippedBytes) {
      throw new BadRequestException({ code: 'IMPORT_ARCHIVE_TOO_LARGE', message: ['unpacked archive exceeds the import size limit'] });
    }
  }
}
