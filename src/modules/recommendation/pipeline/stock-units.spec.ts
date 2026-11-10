import { convertQuantity } from './stock-units';

describe('convertQuantity', () => {
  it('converts millilitres to the litres of a l/ha rate', () => {
    expect(convertQuantity(5000, 'ml', 'l/ha')).toBe(5);
  });
  it('converts tonnes to the kilograms of a kg/ha rate', () => {
    expect(convertQuantity(1, 't', 'kg/ha')).toBe(1000);
  });
  it('returns null for a different dimension or unknown unit', () => {
    expect(convertQuantity(5, 'kg', 'l/ha')).toBeNull();
    expect(convertQuantity(5, null, 'l/ha')).toBeNull();
  });
});
