const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;
const LIST_SEPARATOR = '|';

type Cell = string | number | boolean | null | undefined | string[];

/** Flattens an export DTO: externalIds become scoutId/agronomistId columns, lists are joined. */
export function flattenExportDto(dto: object): Record<string, Cell> {
  const { externalIds, ...rest } = dto as { externalIds: { scoutId: string; agronomistId?: string } } & Record<string, Cell>;
  return { scoutId: externalIds.scoutId, agronomistId: externalIds.agronomistId, ...rest };
}

export function toCsv(rows: Record<string, Cell>[], columns: readonly string[]): string {
  const lines = rows.map((row) => columns.map((column) => formatCell(row[column])).join(','));
  return [columns.join(','), ...lines].join('\r\n') + '\r\n';
}

function formatCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(LIST_SEPARATOR) : String(value);
  // Guards against spreadsheet formula injection from user-entered text.
  const safe = typeof value === 'string' && FORMULA_PREFIX.test(text) ? "'" + text : text;
  return NEEDS_QUOTING.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}
