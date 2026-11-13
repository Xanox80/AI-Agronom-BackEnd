import { WorkingSolution } from './treatment-plan.types';

const DECIMALS = 3;
const PER_100_L = 100;

function round(value: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

/** "l/ha" -> "l", "kg/ha" -> "kg". */
export function productUnitOf(rateUnit: string): string {
  return rateUnit.split('/')[0];
}

/**
 * Proportions of one spraying: product and water per hectare, per tank and for the whole field.
 * A partly filled last tank counts as a tank, which is how a sprayer crew plans refills.
 */
export function workingSolution(rateValue: number, rateUnit: string, waterLPerHa: number, tankVolumeL: number, areaHa: number | null): WorkingSolution {
  const hectaresPerTank = tankVolumeL / waterLPerHa;
  return {
    productPerHa: rateValue,
    productUnit: productUnitOf(rateUnit),
    waterLPerHa,
    productPer100L: round((rateValue / waterLPerHa) * PER_100_L),
    tankVolumeL,
    productPerTank: round(rateValue * hectaresPerTank),
    hectaresPerTank: round(hectaresPerTank),
    tanksForField: areaHa ? Math.ceil(areaHa / hectaresPerTank) : null,
    productForField: areaHa ? round(rateValue * areaHa) : null,
  };
}
