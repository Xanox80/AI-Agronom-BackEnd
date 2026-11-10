export interface StockCsvRow {
  line: number;
  registrationNumber?: string;
  productName?: string;
  quantity: number;
  unit: string;
  warehouse?: string;
}

export interface StockCsvRejection { line: number; reason: string }

const SEPARATOR = /[,;]/;
const BOM = /^﻿/;

/** Minimal CSV reader (no quoted separators): header `registrationNumber|productName,quantity,unit,warehouse`. */
export function parseStockCsv(text: string): { rows: StockCsvRow[]; rejected: StockCsvRejection[] } {
  const lines = text.replace(BOM, '').split(/\r?\n/);
  const header = (lines[0] ?? '').split(SEPARATOR).map((h) => h.trim());
  const at = (name: string) => header.indexOf(name);
  const rows: StockCsvRow[] = [];
  const rejected: StockCsvRejection[] = [];
  if (at('quantity') < 0 || at('unit') < 0 || (at('registrationNumber') < 0 && at('productName') < 0)) {
    return { rows, rejected: [{ line: 1, reason: 'invalid_header' }] };
  }
  lines.slice(1).forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = i + 2;
    const cells = raw.split(SEPARATOR).map((c) => c.trim());
    const get = (name: string) => (at(name) >= 0 ? cells[at(name)] || undefined : undefined);
    const quantity = Number(get('quantity'));
    const unit = get('unit');
    const registrationNumber = get('registrationNumber');
    const productName = get('productName');
    if (!get('quantity') || !Number.isFinite(quantity) || quantity < 0) rejected.push({ line, reason: 'invalid_quantity' });
    else if (!unit) rejected.push({ line, reason: 'missing_unit' });
    else if (!registrationNumber && !productName) rejected.push({ line, reason: 'missing_product' });
    else rows.push({ line, registrationNumber, productName, quantity, unit, warehouse: get('warehouse') });
  });
  return { rows, rejected };
}
