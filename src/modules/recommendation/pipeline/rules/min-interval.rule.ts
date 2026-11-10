import { Injectable } from '@nestjs/common';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule, daysBetween } from './candidate-rule';

@Injectable()
export class MinIntervalRule implements CandidateRule {
  apply(candidate: Candidate, { treatments, today }: PipelineInput): void {
    const { minIntervalDays } = candidate.registration;
    const sinceLast = treatments
      .filter((t) => t.productId === candidate.product.product.id)
      .map((t) => daysBetween(t.appliedAt, today));
    if (sinceLast.length === 0) return;
    const daysSince = Math.min(...sinceLast);
    if (daysSince < minIntervalDays) candidate.exclusion = { code: 'min_interval', params: { daysSince, minDays: minIntervalDays } };
  }
}
