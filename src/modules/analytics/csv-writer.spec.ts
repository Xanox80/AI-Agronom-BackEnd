import { flattenExportDto, toCsv } from './csv-writer';

describe('csv-writer', () => {
  it('writes only the header row for no rows', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b\r\n');
  });

  it('writes a header and quotes cells containing commas, quotes and newlines', () => {
    const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 'l1\nl2' }], ['a', 'b', 'c']);
    expect(csv).toBe('a,b,c\r\n"x,y","say ""hi""","l1\nl2"\r\n');
  });

  it('renders null as empty, joins lists with a pipe and keeps numbers unquoted', () => {
    expect(toCsv([{ a: null, b: ['p', 'q'], c: -5.5 }], ['a', 'b', 'c'])).toBe('a,b,c\r\n,p|q,-5.5\r\n');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(toCsv([{ note: '=SUM(A1)' }], ['note'])).toBe("note\r\n'=SUM(A1)\r\n");
  });

  it('flattens externalIds into scoutId and agronomistId columns', () => {
    const flat = flattenExportDto({ schemaVersion: 1, externalIds: { scoutId: 'u1' }, name: 'N' });
    expect(flat).toEqual({ scoutId: 'u1', agronomistId: undefined, schemaVersion: 1, name: 'N' });
  });
});
