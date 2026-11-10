import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationEntity } from '../../domain/entities';
import { ObservationStatus } from '../../domain/enums';
import { DiagnosisCompletedEvent, DomainEvent } from '../../domain/events';

@Injectable()
export class ObservationStatusListener {
  constructor(@InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>) {}

  @OnEvent(DomainEvent.DiagnosisCompleted)
  async markDiagnosed(event: DiagnosisCompletedEvent): Promise<void> {
    await this.observations.update(
      { id: event.observationId, status: ObservationStatus.Synced },
      { status: ObservationStatus.Diagnosed },
    );
  }
}
