import { SEPTORIA_FACTS } from '../__fixtures__/treatment-facts.fixture';
import { validateTreatmentPlan } from './treatment-plan.validator';

const facts = SEPTORIA_FACTS;

const application = (overrides: Record<string, unknown> = {}) => ({
  productId: 'p1', rateValue: 0.9, waterLPerHa: 200, dayOffset: 0, timing: 'BBCH 37-39', note: '', ...overrides,
});

const plan = (applications: unknown[]) => ({ summary: 'Дві обробки', applications, precautions: ['ЗІЗ'], monitoring: 'Огляд через 7 днів' });

describe('validateTreatmentPlan', () => {
  it('accepts a course that stays within the registered rate, count and interval', () => {
    const result = validateTreatmentPlan(plan([application(), application({ dayOffset: 21 })]), facts);
    expect(result.errors).toEqual([]);
    expect(result.plan?.applications).toHaveLength(2);
  });

  it('rejects a product the engine did not allow', () => {
    expect(validateTreatmentPlan(plan([application({ productId: 'made-up' })]), facts).errors[0]).toContain('not among the allowed products');
  });

  it('rejects a rate above the registry maximum', () => {
    const result = validateTreatmentPlan(plan([application({ rateValue: 1.5 })]), facts);
    expect(result.plan).toBeNull();
    expect(result.errors[0]).toContain('outside the registered 0.8-1');
  });

  it('rejects water outside the sprayer range', () => {
    expect(validateTreatmentPlan(plan([application({ waterLPerHa: 50 })]), facts).errors[0]).toContain('water 50 l/ha');
  });

  it('rejects more applications than registered and too short intervals', () => {
    const errors = validateTreatmentPlan(plan([application(), application({ dayOffset: 7 }), application({ dayOffset: 30 })]), facts).errors;
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('3 applications, registered maximum is 2'),
      expect.stringContaining('7 days between applications'),
    ]));
  });

  it('rejects answers that are not a plan', () => {
    expect(validateTreatmentPlan('text', facts).errors).toEqual(['answer is not a plan object with an applications list']);
    expect(validateTreatmentPlan(plan([]), facts).errors).toEqual(['plan has no applications']);
    expect(validateTreatmentPlan(plan([application({ rateValue: '0.9' })]), facts).plan).toBeNull();
  });
});
