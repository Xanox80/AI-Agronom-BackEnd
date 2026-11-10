import { Injectable } from '@nestjs/common';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule } from './candidate-rule';

@Injectable()
export class BbchWindowRule implements CandidateRule {
  apply(candidate: Candidate, { bbch }: PipelineInput): void {
    const { bbchFrom, bbchTo } = candidate.registration;
    if (bbch !== null && (bbch < bbchFrom || bbch > bbchTo)) {
      candidate.exclusion = { code: 'bbch_window', params: { bbch, from: bbchFrom, to: bbchTo } };
    }
  }
}
