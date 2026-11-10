const UNIT_FACTORS: Record<string, { dimension: 'volume' | 'mass'; toBase: number }> = {
  l: { dimension: 'volume', toBase: 1 },
  ml: { dimension: 'volume', toBase: 0.001 },
  kg: { dimension: 'mass', toBase: 1 },
  g: { dimension: 'mass', toBase: 0.001 },
  t: { dimension: 'mass', toBase: 1000 },
};

/** Converts a stock quantity to the unit of the application rate ("l/ha" -> "l"); null when units are unknown or of another dimension. */
export function convertQuantity(quantity: number, fromUnit: string | null, rateUnit: string): number | null {
  const from = fromUnit ? UNIT_FACTORS[fromUnit.toLowerCase()] : undefined;
  const to = UNIT_FACTORS[rateUnit.split('/')[0].toLowerCase()];
  if (!from || !to || from.dimension !== to.dimension) return null;
  return (quantity * from.toBase) / to.toBase;
}
