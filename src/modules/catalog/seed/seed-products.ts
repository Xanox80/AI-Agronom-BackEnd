import { PollinatorHazard, RateUnit, ResistanceSystem } from '../../../domain/enums';

export interface SeedSubstance { code: string; nameUk: string; nameEn: string; system: ResistanceSystem; group: string }
export interface SeedProduct {
  key: string; name: string; formulation: string; registrant: string; pollinatorHazard: PollinatorHazard;
  waterZoneM: number; apiaryZoneM: number; settlementZoneM: number; pricePerHaUah: number;
  substances: { code: string; concentration: string }[];
}
export interface SeedRegistration {
  productKey: string; cropCode: string; diagnosisCode: string; rateMin: number; rateMax: number; rateUnit: RateUnit;
  maxApplications: number; minIntervalDays: number; preHarvestIntervalDays: number;
  bbchFrom: number; bbchTo: number; efficacyScore: number;
}

const F = ResistanceSystem.Frac;
const I = ResistanceSystem.Irac;

export const SEED_SUBSTANCES: SeedSubstance[] = [
  { code: 'tebuconazole', nameUk: 'тебуконазол', nameEn: 'tebuconazole', system: F, group: '3' },
  { code: 'prothioconazole', nameUk: 'протіоконазол', nameEn: 'prothioconazole', system: F, group: '3' },
  { code: 'cyproconazole', nameUk: 'ципроконазол', nameEn: 'cyproconazole', system: F, group: '3' },
  { code: 'epoxiconazole', nameUk: 'епоксиконазол', nameEn: 'epoxiconazole', system: F, group: '3' },
  { code: 'azoxystrobin', nameUk: 'азоксистробін', nameEn: 'azoxystrobin', system: F, group: '11' },
  { code: 'pyraclostrobin', nameUk: 'піраклостробін', nameEn: 'pyraclostrobin', system: F, group: '11' },
  { code: 'dimoxystrobin', nameUk: 'диметоксистробін', nameEn: 'dimoxystrobin', system: F, group: '11' },
  { code: 'boscalid', nameUk: 'боскалід', nameEn: 'boscalid', system: F, group: '7' },
  { code: 'lambda_cyhalothrin', nameUk: 'лямбда-цигалотрин', nameEn: 'lambda-cyhalothrin', system: I, group: '3A' },
  { code: 'chlorantraniliprole', nameUk: 'хлорантранілипрол', nameEn: 'chlorantraniliprole', system: I, group: '28' },
  { code: 'thiamethoxam', nameUk: 'тіаметоксам', nameEn: 'thiamethoxam', system: I, group: '4A' },
  { code: 'acetamiprid', nameUk: 'ацетаміприд', nameEn: 'acetamiprid', system: I, group: '4A' },
  { code: 'abamectin', nameUk: 'абамектин', nameEn: 'abamectin', system: I, group: '6' },
];

const fungicide = { pollinatorHazard: PollinatorHazard.Low, waterZoneM: 50, apiaryZoneM: 0, settlementZoneM: 200 };
const insecticide = { pollinatorHazard: PollinatorHazard.High, waterZoneM: 150, apiaryZoneM: 4000, settlementZoneM: 300 };
const gentleInsecticide = { pollinatorHazard: PollinatorHazard.Moderate, waterZoneM: 100, apiaryZoneM: 1000, settlementZoneM: 300 };

export const SEED_PRODUCTS: SeedProduct[] = [
  { key: 'folicur', name: 'Folicur 250 EC', formulation: 'EC', registrant: 'Bayer', ...fungicide, pricePerHaUah: 650, substances: [{ code: 'tebuconazole', concentration: '250 g/l' }] },
  { key: 'prosaro', name: 'Prosaro 250 EC', formulation: 'EC', registrant: 'Bayer', ...fungicide, pricePerHaUah: 1250, substances: [{ code: 'prothioconazole', concentration: '125 g/l' }, { code: 'tebuconazole', concentration: '125 g/l' }] },
  { key: 'amistar_extra', name: 'Amistar Extra 280 SC', formulation: 'SC', registrant: 'Syngenta', ...fungicide, pricePerHaUah: 1400, substances: [{ code: 'azoxystrobin', concentration: '200 g/l' }, { code: 'cyproconazole', concentration: '80 g/l' }] },
  { key: 'opera', name: 'Opera 183 SE', formulation: 'SE', registrant: 'BASF', ...fungicide, pricePerHaUah: 1300, substances: [{ code: 'pyraclostrobin', concentration: '133 g/l' }, { code: 'epoxiconazole', concentration: '50 g/l' }] },
  { key: 'pictor', name: 'Pictor 400 SC', formulation: 'SC', registrant: 'BASF', ...fungicide, pricePerHaUah: 1550, substances: [{ code: 'boscalid', concentration: '200 g/l' }, { code: 'dimoxystrobin', concentration: '200 g/l' }] },
  { key: 'karate_zeon', name: 'Karate Zeon 050 CS', formulation: 'CS', registrant: 'Syngenta', ...insecticide, pricePerHaUah: 280, substances: [{ code: 'lambda_cyhalothrin', concentration: '50 g/l' }] },
  { key: 'mospilan', name: 'Mospilan 20 SP', formulation: 'SP', registrant: 'Nippon Soda', ...insecticide, pricePerHaUah: 320, substances: [{ code: 'acetamiprid', concentration: '200 g/kg' }] },
  { key: 'actara', name: 'Actara 25 WG', formulation: 'WG', registrant: 'Syngenta', ...insecticide, pricePerHaUah: 360, substances: [{ code: 'thiamethoxam', concentration: '250 g/kg' }] },
  { key: 'coragen', name: 'Coragen 20 SC', formulation: 'SC', registrant: 'FMC', ...gentleInsecticide, pricePerHaUah: 1100, substances: [{ code: 'chlorantraniliprole', concentration: '200 g/l' }] },
  { key: 'vertimec', name: 'Vertimec 018 EC', formulation: 'EC', registrant: 'Syngenta', ...insecticide, pricePerHaUah: 520, substances: [{ code: 'abamectin', concentration: '18 g/l' }] },
];

const L = RateUnit.LPerHa;
const KG = RateUnit.KgPerHa;
type Row = [string, string, string, number, number, RateUnit, number, number, number, number, number, number];

const REGISTRATION_ROWS: Row[] = [
  ['folicur', 'wheat_winter', 'wheat_yellow_rust', 1.0, 1.0, L, 2, 14, 30, 30, 65, 0.8],
  ['folicur', 'wheat_winter', 'wheat_leaf_rust', 1.0, 1.0, L, 2, 14, 30, 30, 65, 0.8],
  ['folicur', 'wheat_winter', 'septoria_leaf_blotch', 0.75, 1.0, L, 2, 14, 30, 30, 65, 0.7],
  ['folicur', 'wheat_winter', 'powdery_mildew_wheat', 0.75, 1.0, L, 2, 14, 30, 30, 65, 0.7],
  ['folicur', 'sunflower', 'phomopsis_sunflower', 1.0, 1.0, L, 2, 14, 45, 30, 61, 0.75],
  ['prosaro', 'wheat_winter', 'fusarium_head_blight', 0.8, 1.0, L, 2, 14, 35, 55, 69, 0.85],
  ['prosaro', 'wheat_winter', 'septoria_leaf_blotch', 0.8, 1.0, L, 2, 14, 35, 31, 69, 0.9],
  ['prosaro', 'wheat_winter', 'wheat_yellow_rust', 0.8, 1.0, L, 2, 14, 35, 31, 69, 0.85],
  ['prosaro', 'wheat_winter', 'wheat_leaf_rust', 0.8, 1.0, L, 2, 14, 35, 31, 69, 0.85],
  ['prosaro', 'rapeseed', 'phoma_stem_canker', 0.8, 1.0, L, 2, 21, 56, 30, 69, 0.7],
  ['prosaro', 'rapeseed', 'alternaria_rapeseed', 0.8, 1.0, L, 2, 21, 56, 50, 69, 0.7],
  ['amistar_extra', 'wheat_winter', 'septoria_leaf_blotch', 0.75, 1.0, L, 2, 14, 35, 31, 65, 0.8],
  ['amistar_extra', 'wheat_winter', 'powdery_mildew_wheat', 0.75, 1.0, L, 2, 14, 35, 31, 65, 0.75],
  ['amistar_extra', 'soybean', 'soybean_downy_mildew', 0.75, 1.0, L, 2, 14, 30, 12, 69, 0.75],
  ['amistar_extra', 'maize', 'northern_leaf_blight_maize', 0.75, 1.0, L, 2, 14, 30, 30, 65, 0.8],
  ['amistar_extra', 'sunflower', 'white_rot_sclerotinia', 0.8, 1.0, L, 2, 14, 45, 50, 69, 0.6],
  ['opera', 'wheat_winter', 'wheat_yellow_rust', 1.5, 1.5, L, 2, 21, 35, 30, 69, 0.88],
  ['opera', 'wheat_winter', 'wheat_leaf_rust', 1.5, 1.5, L, 2, 21, 35, 30, 69, 0.88],
  ['opera', 'wheat_winter', 'septoria_leaf_blotch', 1.5, 1.5, L, 2, 21, 35, 30, 69, 0.85],
  ['opera', 'wheat_winter', 'powdery_mildew_wheat', 1.0, 1.5, L, 2, 21, 35, 30, 69, 0.8],
  ['opera', 'maize', 'northern_leaf_blight_maize', 1.5, 1.5, L, 2, 21, 35, 30, 69, 0.85],
  ['pictor', 'sunflower', 'white_rot_sclerotinia', 0.5, 0.75, L, 2, 14, 45, 50, 69, 0.8],
  ['pictor', 'rapeseed', 'white_rot_sclerotinia', 0.5, 0.5, L, 2, 14, 56, 55, 69, 0.8],
  ['pictor', 'soybean', 'white_rot_sclerotinia', 0.5, 0.5, L, 2, 14, 35, 55, 69, 0.75],
  ['pictor', 'rapeseed', 'alternaria_rapeseed', 0.5, 0.5, L, 2, 14, 56, 50, 69, 0.8],
  ['karate_zeon', 'wheat_winter', 'cereal_leaf_beetle', 0.15, 0.15, L, 2, 14, 28, 20, 69, 0.85],
  ['karate_zeon', 'wheat_winter', 'cereal_aphids', 0.15, 0.15, L, 2, 14, 28, 20, 79, 0.8],
  ['karate_zeon', 'maize', 'european_corn_borer', 0.15, 0.2, L, 2, 14, 30, 51, 69, 0.75],
  ['karate_zeon', 'rapeseed', 'pollen_beetle', 0.15, 0.15, L, 2, 14, 28, 50, 59, 0.85],
  ['karate_zeon', 'rapeseed', 'cabbage_stem_flea_beetle', 0.15, 0.15, L, 2, 14, 28, 10, 19, 0.8],
  ['mospilan', 'wheat_winter', 'cereal_aphids', 0.1, 0.15, KG, 2, 14, 30, 20, 79, 0.8],
  ['mospilan', 'rapeseed', 'pollen_beetle', 0.15, 0.2, KG, 2, 14, 30, 50, 59, 0.8],
  ['mospilan', 'rapeseed', 'cabbage_stem_flea_beetle', 0.15, 0.2, KG, 2, 14, 30, 10, 19, 0.75],
  ['mospilan', 'maize', 'western_corn_rootworm', 0.15, 0.2, KG, 2, 14, 30, 61, 79, 0.7],
  ['actara', 'wheat_winter', 'cereal_aphids', 0.1, 0.14, KG, 1, 14, 30, 20, 69, 0.8],
  ['actara', 'rapeseed', 'cabbage_stem_flea_beetle', 0.08, 0.1, KG, 1, 14, 30, 10, 19, 0.75],
  ['coragen', 'maize', 'european_corn_borer', 0.1, 0.15, L, 2, 14, 30, 51, 69, 0.9],
  ['vertimec', 'soybean', 'spider_mite', 0.75, 1.0, L, 2, 14, 30, 30, 69, 0.8],
  ['vertimec', 'sunflower', 'spider_mite', 0.75, 1.0, L, 2, 14, 30, 30, 69, 0.8],
];

export const SEED_REGISTRATIONS: SeedRegistration[] = REGISTRATION_ROWS.map(
  ([productKey, cropCode, diagnosisCode, rateMin, rateMax, rateUnit, maxApplications, minIntervalDays, preHarvestIntervalDays, bbchFrom, bbchTo, efficacyScore]) => ({
    productKey, cropCode, diagnosisCode, rateMin, rateMax, rateUnit, maxApplications, minIntervalDays,
    preHarvestIntervalDays, bbchFrom, bbchTo, efficacyScore,
  }),
);
