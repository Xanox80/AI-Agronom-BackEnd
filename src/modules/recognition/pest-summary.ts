import { PestStage } from '../../domain/enums';
import { VisionPest } from '../vision-provider/vision.types';

export interface PestSummary {
  species: string | null;
  stage: PestStage;
  densityPerPlant: number | null;
  densityPerM2: number | null;
}

const mostCommon = <T>(values: T[]): T | undefined => {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const meanOrNull = (values: (number | null)[]): number | null => {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : null;
};

/** FR-9: species and stage by majority over the photo series, density as the mean of the frames. */
export function summarisePests(pests: VisionPest[], plantsPerM2: number): PestSummary | null {
  if (!pests.length) return null;
  const densityPerPlant = meanOrNull(pests.map((pest) => pest.densityPerPlant));
  const densityPerM2 = meanOrNull(pests.map((pest) => pest.densityPerM2))
    ?? (densityPerPlant === null ? null : densityPerPlant * plantsPerM2);
  return {
    species: mostCommon(pests.flatMap((pest) => (pest.species ? [pest.species] : []))) ?? null,
    stage: mostCommon(pests.map((pest) => pest.stage)) ?? PestStage.Unknown,
    densityPerPlant,
    densityPerM2,
  };
}
