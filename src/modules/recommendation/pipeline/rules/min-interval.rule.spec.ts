import { candidate, pipelineInput, registration, treatment } from '../../__fixtures__/pipeline-fixtures';
import { MinIntervalRule } from './min-interval.rule';

describe('MinIntervalRule', () => {
  const rule = new MinIntervalRule();

  it('excludes a product applied more recently than its minimum interval', () => {
    const c = candidate({ registration: registration({ minIntervalDays: 14 }) });
    rule.apply(c, pipelineInput({ treatments: [treatment({ appliedAt: '2026-06-01' })] }));
    expect(c.exclusion?.code).toBe('min_interval');
  });

  it('keeps a product whose last application is older than the interval', () => {
    const c = candidate({ registration: registration({ minIntervalDays: 14 }) });
    rule.apply(c, pipelineInput({ treatments: [treatment({ appliedAt: '2026-05-01' })] }));
    expect(c.exclusion).toBeNull();
  });

  it('keeps a product never applied on the field', () => {
    const c = candidate();
    rule.apply(c, pipelineInput());
    expect(c.exclusion).toBeNull();
  });
});
