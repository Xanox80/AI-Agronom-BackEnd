import { ObservationStatus } from '../../domain/enums';
import { ObservationStatusListener } from './observation-status.listener';

describe('ObservationStatusListener', () => {
  it('moves a synced observation to diagnosed without touching confirmed ones', async () => {
    const observations = { update: jest.fn() };
    await new ObservationStatusListener(observations as never).markDiagnosed({ observationId: 'o1' } as never);
    expect(observations.update).toHaveBeenCalledWith(
      { id: 'o1', status: ObservationStatus.Synced },
      { status: ObservationStatus.Diagnosed },
    );
  });
});
