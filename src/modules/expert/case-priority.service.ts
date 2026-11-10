import { Inject, Injectable } from '@nestjs/common';
import { ExpertCaseReason } from '../../domain/enums';
import { EXPERT_CONFIG, ExpertConfig } from './expert.config';

@Injectable()
export class CasePriorityService {
  constructor(@Inject(EXPERT_CONFIG) private readonly config: ExpertConfig) {}

  /** Higher is more urgent: reason base, plus model uncertainty, plus a bonus for rare classes. */
  priorityOf(reason: ExpertCaseReason, topProbability: number, rare: boolean): number {
    const uncertainty = Math.round((1 - topProbability) * this.config.uncertaintyPriorityScale);
    return this.config.priorityByReason[reason] + uncertainty + (rare ? this.config.rareClassPriorityBonus : 0);
  }
}
