import { candidate, pipelineInput, registration, settings } from '../../__fixtures__/pipeline-fixtures';
import { PreHarvestIntervalRule } from './pre-harvest-interval.rule';

describe('PreHarvestIntervalRule', () => {
  const rule = new PreHarvestIntervalRule(settings());
  const field = (sowingDate: string | null) => ({ id: 'f', areaHa: 1, sowingDate, nearWater: false, nearApiary: false, nearSettlement: false });

  it('excludes a product whose pre-harvest interval exceeds the estimated days to harvest', () => {
    const c = candidate({ registration: registration({ preHarvestIntervalDays: 40 }) });
    rule.apply(c, pipelineInput({ crop: { id: 'c', code: 'maize' }, field: field('2026-02-01') }));
    expect(c.exclusion?.code).toBe('pre_harvest_interval');
  });

  it('keeps a product when enough days remain before harvest', () => {
    const c = candidate({ registration: registration({ preHarvestIntervalDays: 30 }) });
    rule.apply(c, pipelineInput({ crop: { id: 'c', code: 'wheat_winter' }, field: field('2025-10-01') }));
    expect(c.exclusion).toBeNull();
  });

  it('keeps a product when the sowing date is unknown', () => {
    const c = candidate({ registration: registration({ preHarvestIntervalDays: 400 }) });
    rule.apply(c, pipelineInput({ field: field(null) }));
    expect(c.exclusion).toBeNull();
  });
});
