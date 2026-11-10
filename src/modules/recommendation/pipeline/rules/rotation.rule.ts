import { Inject, Injectable } from '@nestjs/common';
import { ResistanceSystem } from '../../../../domain/enums';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from '../../recommendation.settings';
import { Candidate, PipelineInput } from '../pipeline-types';
import { CandidateRule } from './candidate-rule';

/** FR-17: limits repeated use of one FRAC/IRAC/HRAC group on a field within the season. */
@Injectable()
export class RotationRule implements CandidateRule {
  constructor(@Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings) {}

  apply(candidate: Candidate, { treatments }: PipelineInput): void {
    const max = this.settings.maxSameGroupPerSeason;
    for (const { resistanceSystem: system, resistanceGroup: group } of candidate.product.substances) {
      if (system === ResistanceSystem.None || !group) continue;
      const used = treatments.filter((t) => t.resistanceGroups.some((g) => g.system === system && g.group === group)).length;
      if (used === 0) continue;
      const params = { system, group, used, max };
      candidate.rotationNote = { code: 'rotation_group_used', params };
      if (used >= max) {
        candidate.rotationOk = false;
        candidate.exclusion = { code: 'rotation_limit', params };
        return;
      }
    }
  }
}
