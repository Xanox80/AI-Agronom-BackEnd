import { ConfigService } from '@nestjs/config';
import { FieldsSettings } from '../fields.settings';

export const FIELDS_ENV: Record<string, string> = {
  FIELDS_NEARBY_LIMIT: '5',
  FIELDS_NEARBY_MAX_KM: '5',
  FIELDS_IMPORT_MAX_MB: '20',
  FIELDS_IMPORT_MAX_UNZIPPED_MB: '100',
  FIELDS_IMPORT_FALLBACK_NAME: 'Field',
  FIELDS_DEFAULT_PAGE_SIZE: '20',
  FIELDS_MAX_PAGE_SIZE: '100',
  FIELDS_NAME_MAX_LENGTH: '200',
};

export function fieldsSettings(overrides: Record<string, string> = {}): FieldsSettings {
  const env = { ...FIELDS_ENV, ...overrides };
  return new FieldsSettings({
    getOrThrow: (key: string) => {
      if (env[key] === undefined) throw new Error(`missing ${key}`);
      return env[key];
    },
  } as unknown as ConfigService);
}
