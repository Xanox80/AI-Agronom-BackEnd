import { toQualityMetrics } from './quality-metrics.service';

const base = { diagnosedObservations: 10, casesSentToExpert: 2, resolvedCases: 1, expertConfirms: 3, expertChanges: 1 };

describe('toQualityMetrics', () => {
  it('computes the share sent to experts and the confirmation rate', () => {
    expect(toQualityMetrics(base)).toMatchObject({ shareSentToExpert: 0.2, expertConfirmationRate: 0.75 });
  });

  it('returns zero rates instead of dividing by zero', () => {
    const metrics = toQualityMetrics({ ...base, diagnosedObservations: 0, expertConfirms: 0, expertChanges: 0 });
    expect(metrics.shareSentToExpert).toBe(0);
    expect(metrics.expertConfirmationRate).toBe(0);
  });
});
