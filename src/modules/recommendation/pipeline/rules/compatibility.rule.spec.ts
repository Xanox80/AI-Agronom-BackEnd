import { candidate, pipelineInput, registration, treatment } from '../../__fixtures__/pipeline-fixtures';
import { CompatibilityRule } from './compatibility.rule';

describe('CompatibilityRule', () => {
  const rule = new CompatibilityRule();
  const incompatible = () => candidate({ registration: registration({ incompatibleWith: ['prod-x'], minIntervalDays: 14 }) });

  it('excludes a product when an incompatible product was applied within the interval', () => {
    const c = incompatible();
    rule.apply(c, pipelineInput({ treatments: [treatment({ productId: 'prod-x', appliedAt: '2026-06-05' })] }));
    expect(c.exclusion?.code).toBe('incompatible_product');
  });

  it('keeps a product when the incompatible application is older than the interval', () => {
    const c = incompatible();
    rule.apply(c, pipelineInput({ treatments: [treatment({ productId: 'prod-x', appliedAt: '2026-04-01' })] }));
    expect(c.exclusion).toBeNull();
  });
});
