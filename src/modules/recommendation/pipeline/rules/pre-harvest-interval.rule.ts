import { Inject, Injectable } from '@nestjs/common';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from '../../recommendation.settings';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule, daysBetween } from './candidate-rule';

/** shortcut: harvest date is estimated as sowing date plus a per-crop cycle length; replace with a per-field harvest plan. */
@Injectable()
export class PreHarvestIntervalRule implements CandidateRule {
  constructor(@Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings) {}

  apply(candidate: Candidate, { field, crop, today }: PipelineInput): void {
    if (!field?.sowingDate) return;
    const cycleDays = this.settings.cropCycleDays[crop.code] ?? this.settings.defaultCropCycleDays;
    const daysToHarvest = cycleDays - daysBetween(field.sowingDate, today);
    const { preHarvestIntervalDays } = candidate.registration;
    if (preHarvestIntervalDays > daysToHarvest) {
      candidate.exclusion = { code: 'pre_harvest_interval', params: { intervalDays: preHarvestIntervalDays, daysToHarvest } };
    }
  }
}
