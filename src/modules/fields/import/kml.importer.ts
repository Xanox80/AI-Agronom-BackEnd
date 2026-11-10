import { BadRequestException, Injectable } from '@nestjs/common';
import type { Feature } from 'geojson';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { FieldSource } from '../../../domain/enums';
import { extensionOf, FieldImporter, ImportedFeatures } from './field-importer';

@Injectable()
export class KmlImporter implements FieldImporter {
  supports(fileName: string): boolean {
    return extensionOf(fileName) === 'kml';
  }

  async parse(content: Buffer): Promise<ImportedFeatures> {
    const document = new DOMParser({ errorHandler: () => undefined }).parseFromString(content.toString('utf8'), 'text/xml');
    if (!document?.documentElement) {
      throw new BadRequestException({ code: 'IMPORT_PARSE_FAILED', message: ['file is not valid KML'] });
    }
    return { source: FieldSource.ImportKml, features: kml(document as unknown as Document).features as Feature[] };
  }
}
