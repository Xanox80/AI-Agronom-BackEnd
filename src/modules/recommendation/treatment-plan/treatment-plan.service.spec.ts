import { SEPTORIA_FACTS } from '../__fixtures__/treatment-facts.fixture';
import { TreatmentFacts } from './treatment-plan.types';
import { ServiceUnavailableException } from '@nestjs/common';
import { TreatmentWriter, TreatmentWriterError } from './groq-treatment-writer';
import { TreatmentFactsLoader } from './treatment-facts.loader';
import { TreatmentPlanService } from './treatment-plan.service';
import { buildTreatmentPlanSettings } from './treatment-plan.settings';

const facts = SEPTORIA_FACTS;

const answer = (rateValue: number) => ({
  summary: 'Дві обробки Prosaro', precautions: ['Респіратор'], monitoring: 'Огляд через 10 днів',
  applications: [
    { productId: 'p1', rateValue, waterLPerHa: 200, dayOffset: 21, timing: 'BBCH 55', note: '' },
    { productId: 'p1', rateValue, waterLPerHa: 200, dayOffset: 0, timing: 'BBCH 37', note: '' },
  ],
});

describe('TreatmentPlanService', () => {
  const settings = buildTreatmentPlanSettings('key', {});
  const loader = (loaded: TreatmentFacts) => ({ load: jest.fn().mockResolvedValue(loaded) }) as unknown as TreatmentFactsLoader;
  const writer = (write: jest.Mock): TreatmentWriter => ({ model: 'gpt-oss', write });

  it('returns a checked course in day order with tank and field proportions', async () => {
    const plan = await new TreatmentPlanService(loader(facts), writer(jest.fn().mockResolvedValue(answer(1))), settings).generate('farm', 'rec', 3000);
    expect(plan).toMatchObject({ status: 'ready', model: 'gpt-oss', summary: 'Дві обробки Prosaro', validationErrors: [] });
    expect(plan.applications.map((a) => a.dayOffset)).toEqual([0, 21]);
    expect(plan.applications[0]).toMatchObject({ productName: 'Prosaro 250 EC', rateUnit: 'l/ha' });
    expect(plan.applications[0].solution).toMatchObject({ productPerTank: 15, tanksForField: 3, productForField: 45 });
  });

  it('rejects a course that breaks the registered rate and shows none of it', async () => {
    const plan = await new TreatmentPlanService(loader(facts), writer(jest.fn().mockResolvedValue(answer(3))), settings).generate('farm', 'rec');
    expect(plan.status).toBe('rejected');
    expect(plan.applications).toEqual([]);
    expect(plan.validationErrors[0]).toContain('outside the registered');
  });

  it('does not ask the model when the engine sees nothing to apply', async () => {
    const write = jest.fn();
    const plan = await new TreatmentPlanService(loader({ ...facts, actionLevel: 'observe' }), writer(write), settings).generate('farm', 'rec');
    expect(plan).toMatchObject({ status: 'no_treatment', model: null });
    expect(write).not.toHaveBeenCalled();
  });

  it('answers 503 without a Groq key or when Groq fails', async () => {
    await expect(new TreatmentPlanService(loader(facts), null, settings).generate('farm', 'rec')).rejects.toThrow(ServiceUnavailableException);
    const failing = writer(jest.fn().mockRejectedValue(new TreatmentWriterError('429')));
    await expect(new TreatmentPlanService(loader(facts), failing, settings).generate('farm', 'rec')).rejects.toThrow('TREATMENT_PLAN_UNAVAILABLE');
  });
});
