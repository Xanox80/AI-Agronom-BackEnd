import { ActionLevel, ProblemCategory, ThresholdMetric } from '../../../domain/enums';
import { contextFor, pipelineInput, settings, threshold } from '../__fixtures__/pipeline-fixtures';
import { ActionLevelStep } from './action-level.step';
import { CONSULT_EXPERT_WARNING, DiagnosisInput, newContext } from './pipeline-types';

const step = new ActionLevelStep(settings());

async function levelFor(diagnosis: Partial<DiagnosisInput>, extra: Parameters<typeof pipelineInput>[0] = {}) {
  const base = pipelineInput();
  const context = newContext({ ...base, ...extra, diagnosis: { ...base.diagnosis, ...diagnosis } });
  await step.run(context);
  return context;
}

describe('ActionLevelStep', () => {
  it('observes and stops when no problem is found', async () => {
    const context = await levelFor({ category: ProblemCategory.Normal });
    expect(context.actionLevel).toBe(ActionLevel.Observe);
    expect(context.stopped).toBe(true);
  });

  it('observes and asks for an expert when the diagnosis is unsure and not confirmed', async () => {
    const context = await levelFor({ unsure: true });
    expect(context.actionLevel).toBe(ActionLevel.Observe);
    expect(context.warnings.map((w) => w.code)).toContain(CONSULT_EXPERT_WARNING);
  });

  it('observes when probability is below the minimum action probability', async () => {
    const context = await levelFor({ probability: 0.3 });
    expect(context.actionLevel).toBe(ActionLevel.Observe);
    expect(context.stopped).toBe(true);
  });

  it('ignores low probability when the user confirmed the diagnosis', async () => {
    const context = await levelFor({ probability: 0.3, confirmed: true });
    expect(context.actionLevel).toBe(ActionLevel.Threshold);
  });

  it('is urgent for a quarantine diagnosis and reports it', async () => {
    const context = await levelFor({ isQuarantine: true });
    expect(context.actionLevel).toBe(ActionLevel.Urgent);
    expect(context.warnings.map((w) => w.code)).toContain('quarantine_report');
  });

  it('treats when measured density reaches the damage threshold', async () => {
    const context = await levelFor({ pestDensityPerM2: 12 }, { thresholds: [threshold()] });
    expect(context.actionLevel).toBe(ActionLevel.Treat);
    expect(context.thresholdExceeded).toBe(true);
  });

  it('treats a disease when the measured damage percent reaches the threshold', async () => {
    const context = await levelFor({ damagePercent: 20 }, { thresholds: [threshold({ metric: ThresholdMetric.PercentLeafArea, thresholdValue: 10, urgentValue: null })] });
    expect(context.actionLevel).toBe(ActionLevel.Treat);
    expect(context.thresholdExceeded).toBe(true);
  });

  it('warns that the threshold was not measured when the metric has no density input', async () => {
    const context = await levelFor({ pestDensityPerM2: 12 }, { thresholds: [threshold({ metric: ThresholdMetric.PercentLeafArea })] });
    expect(context.warnings.map((w) => w.code)).toContain('threshold_unmeasured');
    expect(context.thresholdExceeded).toBeNull();
  });

  it('is urgent when density reaches the urgent value', async () => {
    const context = await levelFor({ pestDensityPerM2: 35 }, { thresholds: [threshold()] });
    expect(context.actionLevel).toBe(ActionLevel.Urgent);
  });

  it('reports the threshold level when density approaches the damage threshold', async () => {
    const context = await levelFor({ pestDensityPerM2: 8 }, { thresholds: [threshold()] });
    expect(context.actionLevel).toBe(ActionLevel.Threshold);
    expect(context.thresholdExceeded).toBe(false);
  });

  it('observes when density is well below the damage threshold', async () => {
    const context = await levelFor({ pestDensityPerM2: 2 }, { thresholds: [threshold()] });
    expect(context.actionLevel).toBe(ActionLevel.Observe);
    expect(context.stopped).toBe(true);
  });

  it('observes when the crop phase is outside every damage threshold phase', async () => {
    const context = await levelFor({ pestDensityPerM2: 50 }, { thresholds: [threshold()], bbch: 85 });
    expect(context.actionLevel).toBe(ActionLevel.Observe);
    expect(context.actionReason.code).toBe('phase_outside_threshold');
  });

  it('falls back to the threshold level when density was not measured', async () => {
    const context = await levelFor({}, { thresholds: [threshold()] });
    expect(context.actionLevel).toBe(ActionLevel.Threshold);
    expect(context.thresholdExceeded).toBeNull();
  });

  it('treats a critical diagnosis even when density is unknown', async () => {
    const context = await levelFor({ isCritical: true });
    expect(context.actionLevel).toBe(ActionLevel.Treat);
  });

  it('starts every context at observe', () => {
    expect(contextFor().actionLevel).toBe(ActionLevel.Observe);
  });
});
