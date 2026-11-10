import { BadRequestException } from '@nestjs/common';

/** Fetch `maxRows + 1` rows, then fail loudly instead of silently truncating an export. */
export function enforceRowCap<T>(rows: T[], maxRows: number): T[] {
  if (rows.length > maxRows) {
    throw new BadRequestException(`Selection exceeds ${maxRows} rows; narrow the filter (field, crop, dates)`);
  }
  return rows;
}
