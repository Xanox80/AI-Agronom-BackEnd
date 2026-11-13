import { TreatmentFacts } from '../treatment-plan/treatment-plan.types';

/** Winter wheat with septoria and one registered fungicide: 0.8-1 l/ha, at most 2 sprayings 14+ days apart. */
export const SEPTORIA_FACTS: TreatmentFacts = {
  cropNameUk: 'Пшениця озима', diagnosisNameUk: 'Септоріоз листя', bbch: 37, areaHa: 45, actionLevel: 'treat',
  weatherVerdict: 'go', warningCodes: [], waterLPerHa: { min: 100, max: 400 },
  products: [{
    productId: 'p1', name: 'Prosaro 250 EC', activeSubstances: 'протіоконазол, тебуконазол', rateMin: 0.8, rateMax: 1,
    rateUnit: 'l/ha', maxApplications: 2, minIntervalDays: 14, preHarvestIntervalDays: 30, bbchFrom: 30, bbchTo: 69,
    resistanceGroup: '3', inStock: true,
  }],
};
