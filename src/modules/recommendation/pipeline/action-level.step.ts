import { Inject, Injectable } from '@nestjs/common';
import { ActionLevel, ProblemCategory, ThresholdMetric } from '../../../domain/enums';
import { ThresholdEntity } from '../../../domain/entities';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from '../recommendation.settings';
import { CONSULT_EXPERT_WARNING, THRESHOLD_UNMEASURED_WARNING, DiagnosisInput, PipelineContext, PipelineStep, warn } from './pipeline-types';

const MEASURED_DENSITY: Partial<Record<ThresholdMetric, (diagnosis: DiagnosisInput) => number | null>> = {
  [ThresholdMetric.PestsPerM2]: (d) => d.pestDensityPerM2,
  [ThresholdMetric.PestsPerPlant]: (d) => d.pestDensityPerPlant,
  [ThresholdMetric.PercentLeafArea]: (d) => d.damagePercent,
  [ThresholdMetric.PercentPlants]: (d) => d.damagePercent,
};

/** Step 1 (FR-13): action level from the damage threshold, crop phase, measured density and diagnosis probability. */
@Injectable()
export class ActionLevelStep implements PipelineStep {
  constructor(@Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings) {}

  async run(context: PipelineContext): Promise<void> {
    const { diagnosis, thresholds, bbch } = context.input;
    context.threshold = this.thresholdForPhase(thresholds, bbch);

    if (diagnosis.category === ProblemCategory.Normal) return this.observe(context, 'no_problem');
    if (!diagnosis.confirmed && (diagnosis.unsure || diagnosis.probability < this.settings.minActionProbability)) {
      warn(context, CONSULT_EXPERT_WARNING, 'warning', { cause: 'diagnosis_unsure' });
      return this.observe(context, 'diagnosis_unsure', { probability: diagnosis.probability });
    }
    if (diagnosis.isQuarantine) {
      warn(context, 'quarantine_report', 'critical');
      return this.set(context, ActionLevel.Urgent, 'quarantine');
    }
    if (thresholds.length > 0 && bbch !== null && !context.threshold) return this.observe(context, 'phase_outside_threshold', { bbch });
    this.fromThreshold(context);
  }

  private thresholdForPhase(thresholds: ThresholdEntity[], bbch: number | null): ThresholdEntity | null {
    return thresholds.find((t) => bbch === null || (bbch >= t.bbchFrom && bbch <= t.bbchTo)) ?? null;
  }

  private fromThreshold(context: PipelineContext): void {
    const { threshold } = context;
    const { diagnosis } = context.input;
    const density = threshold ? MEASURED_DENSITY[threshold.metric]?.(diagnosis) ?? null : null;
    if (threshold && density === null) warn(context, THRESHOLD_UNMEASURED_WARNING, 'info', { metric: threshold.metric });
    if (!threshold || density === null) {
      return this.set(context, diagnosis.isCritical ? ActionLevel.Treat : ActionLevel.Threshold, 'density_unknown');
    }
    const params = { density, threshold: threshold.thresholdValue, unit: threshold.unit };
    context.thresholdExceeded = density >= threshold.thresholdValue;
    if (threshold.urgentValue !== null && density >= threshold.urgentValue) return this.set(context, ActionLevel.Urgent, 'above_urgent', params);
    if (context.thresholdExceeded) return this.set(context, ActionLevel.Treat, 'above_threshold', params);
    if (density >= threshold.thresholdValue * this.settings.approachingThresholdFraction) return this.set(context, ActionLevel.Threshold, 'near_threshold', params);
    this.observe(context, 'below_threshold', params);
  }

  private observe(context: PipelineContext, code: string, params: Record<string, unknown> = {}): void {
    this.set(context, ActionLevel.Observe, code, params);
    context.stopped = true;
  }

  private set(context: PipelineContext, level: ActionLevel, code: string, params: Record<string, unknown> = {}): void {
    context.actionLevel = level;
    context.actionReason = { code, params };
  }
}
