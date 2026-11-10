import { Injectable } from '@nestjs/common';
import { ApplicationCountRule } from './rules/application-count.rule';
import { BbchWindowRule } from './rules/bbch-window.rule';
import { CandidateRule } from './rules/candidate-rule';
import { CompatibilityRule } from './rules/compatibility.rule';
import { MinIntervalRule } from './rules/min-interval.rule';
import { PreHarvestIntervalRule } from './rules/pre-harvest-interval.rule';
import { RotationRule } from './rules/rotation.rule';
import { CONSULT_EXPERT_WARNING, PRE_HARVEST_UNVERIFIED_WARNING, PipelineContext, PipelineStep, eligible, warn } from './pipeline-types';

/** Step 3: runs the filter rules in order; the first matching rule excludes a product, which stays listed for transparency. */
@Injectable()
export class FilterStep implements PipelineStep {
  private readonly rules: CandidateRule[];

  constructor(
    bbch: BbchWindowRule, preHarvest: PreHarvestIntervalRule, applicationCount: ApplicationCountRule,
    minInterval: MinIntervalRule, compatibility: CompatibilityRule, rotation: RotationRule,
  ) {
    this.rules = [bbch, preHarvest, applicationCount, minInterval, compatibility, rotation];
  }

  async run(context: PipelineContext): Promise<void> {
    for (const candidate of context.candidates) {
      for (const rule of this.rules) {
        if (candidate.exclusion) break;
        rule.apply(candidate, context.input);
      }
    }
    this.warnWhenHarvestDateUnknown(context);
    if (eligible(context).length === 0) {
      warn(context, CONSULT_EXPERT_WARNING, 'warning', { cause: 'all_products_excluded' });
      context.stopped = true;
    }
  }

  private warnWhenHarvestDateUnknown(context: PipelineContext): void {
    if (context.input.field?.sowingDate) return;
    const bound = eligible(context).filter((c) => c.registration.preHarvestIntervalDays > 0);
    if (bound.length > 0) warn(context, PRE_HARVEST_UNVERIFIED_WARNING, 'warning', { products: bound.map((c) => c.product.product.name) });
  }
}
