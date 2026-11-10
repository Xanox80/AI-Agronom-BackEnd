import { ExpertCaseReason } from '../../domain/enums';
import { CasePriorityService } from './case-priority.service';
import { buildExpertConfig } from './expert.config';

describe('CasePriorityService', () => {
  const service = new CasePriorityService(buildExpertConfig({}));

  it('ranks disagreement above low confidence', () => {
    expect(service.priorityOf(ExpertCaseReason.UserModelDisagreement, 0.6, false))
      .toBeGreaterThan(service.priorityOf(ExpertCaseReason.LowConfidence, 0.6, false));
  });

  it('adds a bonus for rare classes', () => {
    expect(service.priorityOf(ExpertCaseReason.LowConfidence, 0.5, true))
      .toBeGreaterThan(service.priorityOf(ExpertCaseReason.LowConfidence, 0.5, false));
  });

  it('raises priority as the model gets less certain', () => {
    expect(service.priorityOf(ExpertCaseReason.LowConfidence, 0.2, false))
      .toBeGreaterThan(service.priorityOf(ExpertCaseReason.LowConfidence, 0.8, false));
  });
});
