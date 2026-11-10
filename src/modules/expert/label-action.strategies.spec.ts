import { LabelAction } from '../../domain/enums';
import { LABEL_ACTION_STRATEGIES } from './label-action.strategies';

const run = (action: LabelAction, dto: object, top: string | null = 'top') =>
  LABEL_ACTION_STRATEGIES[action]({ dto: { action, ...dto } as never, modelTopDiagnosisId: top });

describe('LABEL_ACTION_STRATEGIES', () => {
  it('confirm points at the model top diagnosis', () => {
    expect(run(LabelAction.Confirm, {}).diagnosisId).toBe('top');
  });

  it('confirm fails when the top hypothesis is unmapped', () => {
    expect(() => run(LabelAction.Confirm, {}, null)).toThrow();
  });

  it('change requires and uses the given diagnosis', () => {
    expect(run(LabelAction.Change, { diagnosisId: 'x' }).diagnosisId).toBe('x');
    expect(() => run(LabelAction.Change, {})).toThrow();
  });

  it('add_new_class asks for a proposal and has no diagnosis yet', () => {
    expect(run(LabelAction.AddNewClass, { newClass: { code: 'new' } })).toEqual({ diagnosisId: null, proposeNewClass: true });
    expect(() => run(LabelAction.AddNewClass, {})).toThrow();
  });

  it('reject carries no diagnosis', () => {
    expect(run(LabelAction.Reject, {})).toEqual({ diagnosisId: null, proposeNewClass: false });
  });
});
