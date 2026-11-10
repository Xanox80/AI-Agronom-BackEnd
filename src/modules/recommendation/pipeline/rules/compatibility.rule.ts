import { Injectable } from '@nestjs/common';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule, daysBetween } from './candidate-rule';

/** A product is skipped when a label-incompatible product was applied on the field within its minimum interval. */
@Injectable()
export class CompatibilityRule implements CandidateRule {
  apply(candidate: Candidate, { treatments, today }: PipelineInput): void {
    const { incompatibleWith, minIntervalDays } = candidate.registration;
    const clash = treatments.find((t) => incompatibleWith.includes(t.productId) && daysBetween(t.appliedAt, today) < minIntervalDays);
    if (clash) candidate.exclusion = { code: 'incompatible_product', params: { productId: clash.productId } };
  }
}
