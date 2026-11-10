export interface SeedCrop { code: string; nameUk: string; nameEn: string }
export interface SeedBbchPhase { from: number; to: number; phase: string; nameUk: string; nameEn: string }

export const SEED_CROPS: SeedCrop[] = [
  { code: 'wheat_winter', nameUk: 'Пшениця озима', nameEn: 'Winter wheat' },
  { code: 'maize', nameUk: 'Кукурудза', nameEn: 'Maize' },
  { code: 'sunflower', nameUk: 'Соняшник', nameEn: 'Sunflower' },
  { code: 'soybean', nameUk: 'Соя', nameEn: 'Soybean' },
  { code: 'rapeseed', nameUk: 'Ріпак', nameEn: 'Rapeseed' },
];

/** Principal BBCH growth stages are shared by all pilot crops. */
export const SEED_BBCH_PHASES: SeedBbchPhase[] = [
  { from: 0, to: 9, phase: 'germination', nameUk: 'Проростання', nameEn: 'Germination' },
  { from: 10, to: 19, phase: 'vegetative', nameUk: 'Розвиток листків', nameEn: 'Leaf development' },
  { from: 20, to: 29, phase: 'vegetative', nameUk: 'Кущення / бічні пагони', nameEn: 'Tillering / side shoots' },
  { from: 30, to: 39, phase: 'vegetative', nameUk: 'Стеблування', nameEn: 'Stem elongation' },
  { from: 40, to: 49, phase: 'vegetative', nameUk: 'Розвиток вегетативних органів', nameEn: 'Development of harvestable vegetative parts' },
  { from: 50, to: 59, phase: 'flowering', nameUk: 'Поява суцвіть', nameEn: 'Inflorescence emergence' },
  { from: 60, to: 69, phase: 'flowering', nameUk: 'Цвітіння', nameEn: 'Flowering' },
  { from: 70, to: 79, phase: 'ripening', nameUk: 'Формування плодів', nameEn: 'Development of fruit' },
  { from: 80, to: 89, phase: 'ripening', nameUk: 'Дозрівання', nameEn: 'Ripening' },
  { from: 90, to: 99, phase: 'senescence', nameUk: 'Відмирання', nameEn: 'Senescence' },
];
