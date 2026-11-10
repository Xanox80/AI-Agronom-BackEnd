import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisHypothesisEntity, DiagnosisResultEntity, ObservationEntity } from '../../domain/entities';
import { ObservationStatus } from '../../domain/enums';
import { DomainEvent, ObservationConfirmedEvent } from '../../domain/events';
import type { ObservationDto } from '../../domain/types';
import { ConfirmObservationDto } from './dto/confirm-observation.dto';
import { AuthUser } from './observation-access';
import { ObservationsService } from './observations.service';

const TOP_RANK = 1;

/** Scenario step 6: the user confirms or corrects the model's top diagnosis. */
@Injectable()
export class ObservationConfirmationService {
  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    private readonly observationsService: ObservationsService,
    private readonly events: EventEmitter2,
  ) {}

  async confirm(user: AuthUser, id: string, dto: ConfirmObservationDto): Promise<ObservationDto> {
    const observation = await this.observationsService.findEntity(user, id);
    const modelTopId = dto.correctedFromModel ? await this.modelTopDiagnosisId(observation.id) : null;

    Object.assign(observation, {
      confirmedDiagnosisId: dto.diagnosisId,
      confirmedByUserId: user.id,
      confirmedAt: new Date(),
      correctedFromDiagnosisId: modelTopId,
      status: ObservationStatus.Confirmed,
    });
    const saved = await this.observations.save(observation);

    const event: ObservationConfirmedEvent = {
      observationId: saved.id, farmId: saved.farmId, userId: user.id, diagnosisId: dto.diagnosisId,
      correctedFromModel: dto.correctedFromModel, correctedFromDiagnosisId: modelTopId ?? undefined,
    };
    this.events.emit(DomainEvent.ObservationConfirmed, event);
    return this.observationsService.toDto(saved);
  }

  private async modelTopDiagnosisId(observationId: string): Promise<string | null> {
    const latest = await this.results.findOne({ where: { observationId }, order: { createdAt: 'DESC' } });
    if (!latest) return null;
    const top = await this.hypotheses.findOneBy({ diagnosisResultId: latest.id, rank: TOP_RANK });
    return top?.diagnosisId ?? null;
  }
}
