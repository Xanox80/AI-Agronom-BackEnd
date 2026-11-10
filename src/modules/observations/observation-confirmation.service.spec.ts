import { ObservationStatus, Role } from '../../domain/enums';
import { DomainEvent } from '../../domain/events';
import { AuthUser } from './observation-access';
import { ObservationConfirmationService } from './observation-confirmation.service';

const user: AuthUser = { id: 'u1', farmId: 'f1', role: Role.Scout };

describe('ObservationConfirmationService', () => {
  const build = (topDiagnosisId: string | null = 'model-top') => {
    const observations = { save: jest.fn(async (row) => row) };
    const results = { findOne: jest.fn(async () => (topDiagnosisId === undefined ? null : { id: 'r1' })) };
    const hypotheses = { findOneBy: jest.fn(async () => ({ diagnosisId: topDiagnosisId })) };
    const observationsService = {
      findEntity: jest.fn(async () => ({ id: 'o1', farmId: 'f1' })),
      toDto: jest.fn(async (row) => row),
    };
    const events = { emit: jest.fn() };
    const service = new ObservationConfirmationService(observations as never, results as never, hypotheses as never, observationsService as never, events as never);
    return { service, observations, events };
  };

  it('confirms the diagnosis and emits the confirmed event', async () => {
    const { service, observations, events } = build();
    await service.confirm(user, 'o1', { diagnosisId: 'd1', correctedFromModel: false });
    expect(observations.save).toHaveBeenCalledWith(expect.objectContaining({
      confirmedDiagnosisId: 'd1', confirmedByUserId: 'u1', status: ObservationStatus.Confirmed, correctedFromDiagnosisId: null,
    }));
    expect(events.emit).toHaveBeenCalledWith(DomainEvent.ObservationConfirmed, expect.objectContaining({ diagnosisId: 'd1', correctedFromModel: false }));
  });

  it('records the overridden model top-1 when the user corrects it', async () => {
    const { service, observations, events } = build('model-top');
    await service.confirm(user, 'o1', { diagnosisId: 'd2', correctedFromModel: true });
    expect(observations.save).toHaveBeenCalledWith(expect.objectContaining({ correctedFromDiagnosisId: 'model-top' }));
    expect(events.emit).toHaveBeenCalledWith(DomainEvent.ObservationConfirmed, expect.objectContaining({ correctedFromDiagnosisId: 'model-top' }));
  });
});
