import { parseStockCsv } from './stock-csv.parser';

describe('parseStockCsv', () => {
  it('parses valid rows and rejects invalid ones with line numbers', () => {
    const { rows, rejected } = parseStockCsv(
      'productName,quantity,unit,warehouse\nAlpha,5,l,w1\nBeta,x,l,\nGamma,2,,\n\nDelta,1,kg,',
    );
    expect(rows.map((r) => [r.line, r.productName, r.quantity, r.warehouse])).toEqual([[2, 'Alpha', 5, 'w1'], [6, 'Delta', 1, undefined]]);
    expect(rejected).toEqual([{ line: 3, reason: 'invalid_quantity' }, { line: 4, reason: 'missing_unit' }]);
  });

  it('rejects a file without the required columns', () => {
    expect(parseStockCsv('foo,bar').rejected).toEqual([{ line: 1, reason: 'invalid_header' }]);
  });
});
