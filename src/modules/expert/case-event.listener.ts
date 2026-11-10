import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent, DiagnosisCompletedEvent, ObservationConfirmedEvent } from '../../domain/events';
import { ExpertCaseService } from './expert-case.service';
import { UserFeedbackService } from './user-feedback.service';

@Injectable()
export class CaseEventListener {
  constructor(private readonly cases: ExpertCaseService, private readonly feedback: UserFeedbackService) {}

  @OnEvent(DomainEvent.DiagnosisCompleted)
  async onDiagnosisCompleted(event: DiagnosisCompletedEvent): Promise<void> {
    await this.cases.openForDiagnosis(event.diagnosisResultId);
  }

  @OnEvent(DomainEvent.ObservationConfirmed)
  async onObservationConfirmed(event: ObservationConfirmedEvent): Promise<void> {
    await this.feedback.record({
      observationId: event.observationId, userId: event.userId, farmId: event.farmId,
      finalDiagnosisId: event.diagnosisId, correctedFromModel: event.correctedFromModel,
    });
  }
}
