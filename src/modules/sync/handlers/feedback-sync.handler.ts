import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisHypothesisEntity, DiagnosisResultEntity, ObservationEntity } from '../../../domain/entities';
import { ObservationStatus, Role, SyncEntityType, SyncStatus } from '../../../domain/enums';
import { DomainEvent, ObservationConfirmedEvent } from '../../../domain/events';
import { FeedbackPayloadDto } from '../dto/payloads.dto';
import {
  EntitySyncHandler, HandlerOutcome, SyncChange, SyncContext, validatePayload,
} from './entity-sync-handler';

const TOP_RANK = 1;

/** A diagnosis confirmation made offline: sets the observation's confirmed diagnosis unless a newer one exists. */
@Injectable()
export class FeedbackSyncHandler implements EntitySyncHandler {
  readonly entityType = SyncEntityType.Feedback;
  readonly roles = [Role.Scout, Role.ChiefAgronomist];

  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async upsert(ctx: SyncContext, change: SyncChange): Promise<HandlerOutcome> {
    const payload = await validatePayload(FeedbackPayloadDto, change.payload);
    const observation = await this.observations.findOneBy({ id: payload.observationId });
    if (!observation) throw new BadRequestException('observation not found');
    if (observation.farmId !== ctx.farmId) throw new ForbiddenException('observation belongs to another farm');
    if (observation.confirmedAt && observation.confirmedAt > change.clientTimestamp) {
      return { status: SyncStatus.Conflict, serverId: observation.id };
    }
    const correctedFrom = payload.correctedFromModel ? await this.modelTopDiagnosisId(observation.id) : null;
    Object.assign(observation, {
      confirmedDiagnosisId: payload.finalDiagnosisId, confirmedByUserId: ctx.userId,
      confirmedAt: change.clientTimestamp, correctedFromDiagnosisId: correctedFrom, status: ObservationStatus.Confirmed,
    });
    await this.observations.save(observation);
    const event: ObservationConfirmedEvent = {
      observationId: observation.id, farmId: observation.farmId, userId: ctx.userId,
      diagnosisId: payload.finalDiagnosisId, correctedFromModel: payload.correctedFromModel,
      correctedFromDiagnosisId: correctedFrom ?? undefined,
    };
    this.events.emit(DomainEvent.ObservationConfirmed, event);
    return { status: SyncStatus.Applied, serverId: observation.id };
  }

  async remove(): Promise<HandlerOutcome> {
    throw new BadRequestException('feedback cannot be deleted');
  }

  private async modelTopDiagnosisId(observationId: string): Promise<string | null> {
    const latest = await this.results.findOne({ where: { observationId }, order: { createdAt: 'DESC' } });
    if (!latest) return null;
    const top = await this.hypotheses.findOneBy({ diagnosisResultId: latest.id, rank: TOP_RANK });
    return top?.diagnosisId ?? null;
  }
}
