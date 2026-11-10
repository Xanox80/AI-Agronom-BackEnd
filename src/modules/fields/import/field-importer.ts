import type { Feature } from 'geojson';
import { FieldSource } from '../../../domain/enums';

export interface ImportedFeatures {
  source: FieldSource;
  features: Feature[];
}

/** One strategy per supported file format. */
export interface FieldImporter {
  supports(fileName: string): boolean;
  parse(content: Buffer): Promise<ImportedFeatures>;
}

export const FIELD_IMPORTERS = Symbol('FIELD_IMPORTERS');

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}
