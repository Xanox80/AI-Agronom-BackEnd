import { MS_PER_DAY } from '../../season';
import { Candidate, PipelineInput } from '../pipeline-types';

/** One filter of step 3; a rule marks the candidate excluded (or annotates it) and never throws. */
export interface CandidateRule {
  apply(candidate: Candidate, input: PipelineInput): void;
}


export function daysBetween(fromIsoDate: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromIsoDate).getTime()) / MS_PER_DAY);
}
