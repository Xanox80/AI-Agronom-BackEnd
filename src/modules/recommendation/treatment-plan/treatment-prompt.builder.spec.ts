import { buildTreatmentSystemPrompt, buildTreatmentUserPrompt } from './treatment-prompt.builder';
import { TreatmentFacts } from './treatment-plan.types';

describe('treatment prompt', () => {
  it('forbids products and rates outside the given list and leaves arithmetic to the program', () => {
    const prompt = buildTreatmentSystemPrompt();
    expect(prompt).toContain('ЛИШЕ препарати з переліку');
    expect(prompt).toContain('[rateMin, rateMax]');
    expect(prompt).toContain('minIntervalDays');
    expect(prompt).toContain('зробить програма');
  });

  it('hands over the field and registry facts as JSON', () => {
    const facts = { cropNameUk: 'Соняшник', products: [{ productId: 'p1', rateMax: 1 }] } as unknown as TreatmentFacts;
    expect(buildTreatmentUserPrompt(facts)).toContain('"productId": "p1"');
  });
});
