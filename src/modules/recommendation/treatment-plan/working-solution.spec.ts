import { productUnitOf, workingSolution } from './working-solution';

describe('workingSolution', () => {
  it('splits 0.5 l/ha at 200 l/ha water into a 3000 l tank and a 45 ha field', () => {
    expect(workingSolution(0.5, 'l/ha', 200, 3000, 45)).toEqual({
      productPerHa: 0.5, productUnit: 'l', waterLPerHa: 200, productPer100L: 0.25, tankVolumeL: 3000,
      productPerTank: 7.5, hectaresPerTank: 15, tanksForField: 3, productForField: 22.5,
    });
  });

  it('counts a partly filled last tank as one more refill', () => {
    expect(workingSolution(1, 'l/ha', 200, 3000, 46).tanksForField).toBe(4);
  });

  it('leaves the field totals out when the field area is unknown', () => {
    expect(workingSolution(0.2, 'kg/ha', 250, 2000, null)).toMatchObject({ productUnit: 'kg', productPerTank: 1.6, tanksForField: null, productForField: null });
  });

  it('takes the product unit from the rate unit', () => {
    expect(productUnitOf('kg/ha')).toBe('kg');
  });
});
