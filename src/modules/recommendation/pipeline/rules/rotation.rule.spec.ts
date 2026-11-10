import { ResistanceSystem } from '../../../../domain/enums';
import { candidate, pipelineInput, productView, settings, substance, treatment } from '../../__fixtures__/pipeline-fixtures';
import { RotationRule } from './rotation.rule';

describe('RotationRule', () => {
  const rule = new RotationRule(settings({ maxSameGroupPerSeason: 2 }));

  it('excludes a product whose resistance group was used up to the seasonal limit', () => {
    const c = candidate();
    rule.apply(c, pipelineInput({ treatments: [treatment({ id: 'a' }), treatment({ id: 'b' })] }));
    expect(c.exclusion?.code).toBe('rotation_limit');
    expect(c.rotationOk).toBe(false);
  });

  it('keeps the product but notes the earlier use when the limit is not reached', () => {
    const c = candidate();
    rule.apply(c, pipelineInput({ treatments: [treatment()] }));
    expect(c.exclusion).toBeNull();
    expect(c.rotationOk).toBe(true);
    expect(c.rotationNote?.code).toBe('rotation_group_used');
  });

  it('does not count a different resistance group', () => {
    const c = candidate();
    rule.apply(c, pipelineInput({ treatments: [treatment({ resistanceGroups: [{ system: 'FRAC', group: '11' }] })] }));
    expect(c.rotationNote).toBeNull();
  });

  it('ignores substances without a resistance system', () => {
    const c = candidate({ product: productView({}, [substance({ resistanceSystem: ResistanceSystem.None, resistanceGroup: '' })]) });
    rule.apply(c, pipelineInput({ treatments: [treatment(), treatment({ id: 'b' })] }));
    expect(c.exclusion).toBeNull();
  });

  it('compares the system as well as the group', () => {
    const c = candidate();
    rule.apply(c, pipelineInput({ treatments: [treatment({ resistanceGroups: [{ system: 'IRAC', group: '3' }] })] }));
    expect(c.rotationNote).toBeNull();
  });
});
