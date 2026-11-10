import { UserDto } from '../../domain/types';
import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  const user = { farmId: 'farm-1' } as UserDto;
  const heatmap = { build: jest.fn().mockResolvedValue({ points: [], fields: [] }) };
  const summary = { build: jest.fn().mockResolvedValue({ total: 0 }) };
  const controller = new AnalyticsController(heatmap as never, summary as never);

  it('builds the heatmap for the caller farm with the query filter', async () => {
    await controller.getHeatmap(user, { season: 2026 });
    expect(heatmap.build).toHaveBeenCalledWith('farm-1', { season: 2026 });
  });

  it('builds the summary for the caller farm with the query filter', async () => {
    await controller.getSummary(user, { cropId: 'c1' });
    expect(summary.build).toHaveBeenCalledWith('farm-1', { cropId: 'c1' });
  });
});
