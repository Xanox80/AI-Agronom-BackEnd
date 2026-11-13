import { NotFoundException } from '@nestjs/common';
import { CatalogReader } from '../catalog.reader';
import { TreatmentFactsLoader } from './treatment-facts.loader';
import { buildTreatmentPlanSettings } from './treatment-plan.settings';

const repo = (findOne: unknown, find: unknown = []) => ({ findOne: jest.fn().mockResolvedValue(findOne), find: jest.fn().mockResolvedValue(find) });

describe('TreatmentFactsLoader', () => {
  const recommendation = {
    id: 'rec', farmId: 'farm', observationId: 'obs', confirmedDiagnosisId: 'diag', actionLevel: 'treat', weatherVerdict: 'go',
    safetyWarnings: [{ code: 'tank_mix_incompatible', params: {}, severity: 'warning' }],
  };
  const item = { productId: 'prod', productRegistrationId: 'reg', activeSubstanceCodes: ['tebuconazole'], resistanceGroup: '3', inStock: true };
  const registration = { id: 'reg', rateMin: 0.5, rateMax: 1, rateUnit: 'l/ha', maxApplications: 2, minIntervalDays: 14, preHarvestIntervalDays: 30, bbchFrom: 30, bbchTo: 69 };
  const catalog = {
    findCrop: jest.fn().mockResolvedValue({ nameUk: 'Пшениця озима' }),
    findDiagnosis: jest.fn().mockResolvedValue({ nameUk: 'Септоріоз листя' }),
    loadProducts: jest.fn().mockResolvedValue(new Map([['prod', { product: { name: 'Folicur 250 EC' }, substances: [{ nameUk: 'тебуконазол', concentration: '250 g/l' }] }]])),
  } as unknown as CatalogReader;

  const loader = (found: unknown) => new TreatmentFactsLoader(
    repo(found) as never, repo(null, [item]) as never, repo({ bbchStage: 37, fieldId: 'field', cropId: null }) as never,
    repo({ areaHa: 45, cropId: 'crop' }) as never, repo(null, [registration]) as never, catalog, buildTreatmentPlanSettings('k', {}),
  );

  it('gathers the field, diagnosis and the kept products with their registry limits', async () => {
    expect(await loader(recommendation).load('farm', 'rec')).toEqual({
      cropNameUk: 'Пшениця озима', diagnosisNameUk: 'Септоріоз листя', bbch: 37, areaHa: 45, actionLevel: 'treat',
      weatherVerdict: 'go', warningCodes: ['tank_mix_incompatible'], waterLPerHa: { min: 100, max: 400 },
      products: [{
        productId: 'prod', name: 'Folicur 250 EC', activeSubstances: 'тебуконазол 250 g/l', rateMin: 0.5, rateMax: 1, rateUnit: 'l/ha',
        maxApplications: 2, minIntervalDays: 14, preHarvestIntervalDays: 30, bbchFrom: 30, bbchTo: 69, resistanceGroup: '3', inStock: true,
      }],
    });
  });

  it('refuses a recommendation of another farm', async () => {
    await expect(loader(null).load('farm', 'rec')).rejects.toThrow(NotFoundException);
  });
});
