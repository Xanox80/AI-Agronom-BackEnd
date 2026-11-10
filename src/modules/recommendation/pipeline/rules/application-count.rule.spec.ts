import { candidate, pipelineInput, productView, registration, substance, treatment } from '../../__fixtures__/pipeline-fixtures';
import { ApplicationCountRule } from './application-count.rule';

describe('ApplicationCountRule', () => {
  const rule = new ApplicationCountRule();

  it('excludes a product that reached its maximum applications this season', () => {
    const c = candidate({ registration: registration({ maxApplications: 2 }) });
    rule.apply(c, pipelineInput({ treatments: [treatment({ id: 'a' }), treatment({ id: 'b' })] }));
    expect(c.exclusion?.code).toBe('max_applications');
  });

  it('keeps a product that is below its maximum applications', () => {
    const c = candidate({ registration: registration({ maxApplications: 2 }) });
    rule.apply(c, pipelineInput({ treatments: [treatment()] }));
    expect(c.exclusion).toBeNull();
  });

  it('excludes a product when its active substance reached the seasonal substance limit', () => {
    const c = candidate({ product: productView({}, [substance({ maxApplicationsPerSeason: 1 })]) });
    rule.apply(c, pipelineInput({ treatments: [treatment({ productId: 'other' })] }));
    expect(c.exclusion?.code).toBe('substance_max_applications');
  });
});
