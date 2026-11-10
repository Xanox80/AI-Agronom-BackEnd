import { candidate, contextFor, registration } from '../__fixtures__/pipeline-fixtures';
import { FilterStep } from './filter.step';
import { CONSULT_EXPERT_WARNING } from './pipeline-types';
import { CandidateRule } from './rules/candidate-rule';

const rule = (apply: CandidateRule['apply']): CandidateRule => ({ apply });

function stepWith(rules: CandidateRule[]) {
  const [bbch, preHarvest, applicationCount, minInterval, compatibility, rotation] = [...rules, ...Array(6).fill(rule(() => undefined))];
  return new FilterStep(bbch, preHarvest, applicationCount, minInterval, compatibility, rotation);
}

describe('FilterStep', () => {
  it('stops at the first rule that excludes a candidate', async () => {
    const later = jest.fn();
    const step = stepWith([rule((c) => { c.exclusion = { code: 'bbch_window', params: {} }; }), rule(later)]);
    const context = contextFor();
    context.candidates = [candidate(), candidate({ registration: registration({ id: 'reg-2' }) })];
    await step.run(context);
    expect(context.candidates.every((c) => c.exclusion?.code === 'bbch_window')).toBe(true);
    expect(later).not.toHaveBeenCalled();
  });

  it('stops the pipeline and asks for an expert when every product is excluded', async () => {
    const step = stepWith([rule((c) => { c.exclusion = { code: 'rotation_limit', params: {} }; })]);
    const context = contextFor();
    context.candidates = [candidate()];
    await step.run(context);
    expect(context.stopped).toBe(true);
    expect(context.warnings.map((w) => w.code)).toContain(CONSULT_EXPERT_WARNING);
  });

  it('warns that the pre-harvest interval is unverified when the sowing date is unknown', async () => {
    const context = contextFor();
    context.candidates = [candidate()];
    await stepWith([]).run(context);
    expect(context.warnings.map((w) => w.code)).toContain('pre_harvest_unverified');
  });

  it('does not warn about the harvest date when the sowing date is known', async () => {
    const context = contextFor({ field: { id: 'f', areaHa: 1, sowingDate: '2026-03-01', nearWater: false, nearApiary: false, nearSettlement: false } });
    context.candidates = [candidate()];
    await stepWith([]).run(context);
    expect(context.warnings.map((w) => w.code)).not.toContain('pre_harvest_unverified');
  });

  it('keeps going when at least one product survives', async () => {
    const step = stepWith([]);
    const context = contextFor();
    context.candidates = [candidate()];
    await step.run(context);
    expect(context.stopped).toBe(false);
  });
});
