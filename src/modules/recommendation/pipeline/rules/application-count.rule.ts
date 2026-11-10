import { Injectable } from '@nestjs/common';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule } from './candidate-rule';

/** Season application limits per product registration and per active substance, from the field treatment log. */
@Injectable()
export class ApplicationCountRule implements CandidateRule {
  apply(candidate: Candidate, { treatments }: PipelineInput): void {
    const { registration, product } = candidate;
    const productUses = treatments.filter((t) => t.productId === product.product.id).length;
    if (productUses >= registration.maxApplications) {
      candidate.exclusion = { code: 'max_applications', params: { used: productUses, max: registration.maxApplications } };
      return;
    }
    for (const substance of product.substances) {
      if (substance.maxApplicationsPerSeason === null) continue;
      const used = treatments.filter((t) => t.activeSubstanceCodes.includes(substance.code)).length;
      if (used >= substance.maxApplicationsPerSeason) {
        candidate.exclusion = { code: 'substance_max_applications', params: { substance: substance.code, used, max: substance.maxApplicationsPerSeason } };
        return;
      }
    }
  }
}
