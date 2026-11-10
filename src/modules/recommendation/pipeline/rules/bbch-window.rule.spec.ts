import { candidate, pipelineInput, registration } from '../../__fixtures__/pipeline-fixtures';
import { BbchWindowRule } from './bbch-window.rule';

describe('BbchWindowRule', () => {
  const rule = new BbchWindowRule();
  const withRegistration = candidate({ registration: registration({ bbchFrom: 30, bbchTo: 39 }) });

  it('excludes a product when the crop stage is outside the registered window', () => {
    rule.apply(withRegistration, pipelineInput({ bbch: 50 }));
    expect(withRegistration.exclusion?.code).toBe('bbch_window');
  });

  it('keeps a product when the stage is inside the window', () => {
    const c = candidate({ registration: registration({ bbchFrom: 30, bbchTo: 39 }) });
    rule.apply(c, pipelineInput({ bbch: 35 }));
    expect(c.exclusion).toBeNull();
  });

  it('keeps a product when the stage is unknown', () => {
    const c = candidate({ registration: registration({ bbchFrom: 30, bbchTo: 39 }) });
    rule.apply(c, pipelineInput({ bbch: null }));
    expect(c.exclusion).toBeNull();
  });
});
