import { ThresholdMetric } from '../../../domain/enums';

export interface SeedThreshold {
  diagnosisCode: string; cropCode: string; bbchFrom: number; bbchTo: number;
  metric: ThresholdMetric; thresholdValue: number; urgentValue: number | null; unit: string;
}

const M = ThresholdMetric;
export const THRESHOLD_UNITS: Record<ThresholdMetric, string> = {
  [M.PercentLeafArea]: '% leaf area', [M.PercentPlants]: '% plants',
  [M.PestsPerM2]: 'pests/m2', [M.PestsPerPlant]: 'pests/plant',
};

type Row = [string, string, number, number, ThresholdMetric, number, number | null];

const ROWS: Row[] = [
  ['septoria_leaf_blotch', 'wheat_winter', 31, 69, M.PercentLeafArea, 5, 15],
  ['wheat_yellow_rust', 'wheat_winter', 30, 69, M.PercentPlants, 3, 10],
  ['wheat_leaf_rust', 'wheat_winter', 30, 69, M.PercentLeafArea, 5, 15],
  ['powdery_mildew_wheat', 'wheat_winter', 30, 69, M.PercentLeafArea, 10, 25],
  ['fusarium_head_blight', 'wheat_winter', 55, 69, M.PercentPlants, 1, 5],
  ['cereal_leaf_beetle', 'wheat_winter', 30, 69, M.PestsPerPlant, 1, 3],
  ['cereal_aphids', 'wheat_winter', 51, 79, M.PestsPerPlant, 10, 25],
  ['northern_leaf_blight_maize', 'maize', 30, 69, M.PercentLeafArea, 10, 25],
  ['european_corn_borer', 'maize', 51, 69, M.PercentPlants, 10, 20],
  ['western_corn_rootworm', 'maize', 61, 79, M.PestsPerPlant, 0.5, 2],
  ['phomopsis_sunflower', 'sunflower', 30, 61, M.PercentPlants, 10, 25],
  ['sunflower_downy_mildew', 'sunflower', 10, 39, M.PercentPlants, 1, 5],
  ['white_rot_sclerotinia', 'sunflower', 50, 69, M.PercentPlants, 5, 15],
  ['white_rot_sclerotinia', 'rapeseed', 55, 69, M.PercentPlants, 5, 15],
  ['white_rot_sclerotinia', 'soybean', 55, 69, M.PercentPlants, 5, 15],
  ['soybean_downy_mildew', 'soybean', 12, 69, M.PercentLeafArea, 10, 25],
  ['spider_mite', 'soybean', 30, 69, M.PercentPlants, 10, 30],
  ['spider_mite', 'sunflower', 30, 69, M.PercentPlants, 10, 30],
  ['phoma_stem_canker', 'rapeseed', 30, 69, M.PercentPlants, 10, 25],
  ['alternaria_rapeseed', 'rapeseed', 50, 69, M.PercentLeafArea, 10, 25],
  ['pollen_beetle', 'rapeseed', 50, 59, M.PestsPerPlant, 3, 6],
  ['cabbage_stem_flea_beetle', 'rapeseed', 10, 19, M.PestsPerPlant, 3, 8],
];

export const SEED_THRESHOLDS: SeedThreshold[] = ROWS.map(
  ([diagnosisCode, cropCode, bbchFrom, bbchTo, metric, thresholdValue, urgentValue]) => ({
    diagnosisCode, cropCode, bbchFrom, bbchTo, metric, thresholdValue, urgentValue, unit: THRESHOLD_UNITS[metric],
  }),
);
