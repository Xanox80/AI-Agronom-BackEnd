import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationEntity } from '../../domain/entities';
import { FieldLinkMethod, ObservationStatus, Role } from '../../domain/enums';
import { DomainEvent, ObservationCreatedEvent } from '../../domain/events';
import type { ObservationDto, Page } from '../../domain/types';
import { CreateObservationDto } from './dto/create-observation.dto';
import { ListObservationsQuery } from './dto/list-observations.query';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { AuthUser } from './observation-access';
import { ObservationContextResolver } from './observation-context.resolver';
import { ObservationMediaService } from './observation-media.service';
import { ObservationMapper } from './observation.mapper';

@Injectable()
export class ObservationsService {
  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    private readonly context: ObservationContextResolver,
    private readonly media: ObservationMediaService,
    private readonly mapper: ObservationMapper,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, dto: CreateObservationDto, userAgent?: string): Promise<ObservationDto> {
    const existing = await this.observations.findOneBy({ clientId: dto.clientId });
    if (existing) {
      if (existing.farmId !== user.farmId) throw new ConflictException('CLIENT_ID_TAKEN');
      return this.toDto(existing);
    }

    await this.context.assertReferencesAllowed(user.farmId, dto.fieldId, dto.cropId);
    const context = await this.context.resolve(user, dto);
    const saved = await this.observations.save(this.observations.create({
      ...context,
      id: dto.clientId,
      clientId: dto.clientId,
      clientCreatedAt: dto.clientCreatedAt ? new Date(dto.clientCreatedAt) : null,
      farmId: user.farmId,
      userId: user.id,
      bbchStage: dto.bbchStage ?? null,
      capturedAt: new Date(dto.capturedAt),
      deviceModel: dto.deviceModel ?? userAgent ?? null,
      organ: dto.organ ?? null,
      textNote: dto.textNote ?? null,
      scaleMarkerUsed: dto.scaleMarkerUsed ?? false,
      status: ObservationStatus.Synced,
      isQuickCapture: user.role === Role.Mechanic || (dto.isQuickCapture ?? false),
    }));
    await this.context.rememberCrop(user, saved.fieldId, saved.cropId);
    const event: ObservationCreatedEvent = { observationId: saved.id, farmId: saved.farmId, userId: saved.userId };
    this.events.emit(DomainEvent.ObservationCreated, event);
    return this.toDto(saved);
  }

  async list(user: AuthUser, query: ListObservationsQuery): Promise<Page<ObservationDto>> {
    const builder = this.observations.createQueryBuilder('o').where('o.farmId = :farmId', { farmId: user.farmId });
    if (query.fieldId) builder.andWhere('o.fieldId = :fieldId', { fieldId: query.fieldId });
    if (query.cropId) builder.andWhere('o.cropId = :cropId', { cropId: query.cropId });
    if (query.status) builder.andWhere('o.status = :status', { status: query.status });
    if (query.from) builder.andWhere('o.capturedAt >= :from', { from: new Date(query.from) });
    if (query.to) builder.andWhere('o.capturedAt <= :to', { to: new Date(query.to) });

    const [rows, total] = await builder
      .orderBy('o.capturedAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items: await this.toDtos(rows), total, page: query.page, pageSize: query.pageSize };
  }

  async get(user: AuthUser, id: string): Promise<ObservationDto> {
    return this.toDto(await this.findEntity(user, id));
  }

  async update(user: AuthUser, id: string, dto: UpdateObservationDto): Promise<ObservationDto> {
    const observation = await this.findEntity(user, id);
    if (observation.userId !== user.id && user.role !== Role.ChiefAgronomist) throw new ForbiddenException('NOT_OBSERVATION_OWNER');

    await this.context.assertReferencesAllowed(user.farmId, dto.fieldId, dto.cropId);
    if (dto.fieldId !== undefined) Object.assign(observation, { fieldId: dto.fieldId, fieldLinkMethod: FieldLinkMethod.Manual });
    if (dto.cropId !== undefined) observation.cropId = dto.cropId;
    if (dto.bbchStage !== undefined) observation.bbchStage = dto.bbchStage;
    if (dto.textNote !== undefined) observation.textNote = dto.textNote;
    if (dto.organ !== undefined) observation.organ = dto.organ;
    const saved = await this.observations.save(observation);
    await this.context.rememberCrop(user, saved.fieldId, saved.cropId);
    return this.toDto(saved);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const observation = await this.findEntity(user, id);
    await this.media.removeAll(observation.id);
    await this.observations.remove(observation);
  }

  async findEntity(user: AuthUser, id: string): Promise<ObservationEntity> {
    const observation = await this.observations.findOneBy({ id, farmId: user.farmId });
    if (!observation) throw new NotFoundException('OBSERVATION_NOT_FOUND');
    return observation;
  }

  async toDto(observation: ObservationEntity): Promise<ObservationDto> {
    return (await this.toDtos([observation]))[0];
  }

  private async toDtos(observations: ObservationEntity[]): Promise<ObservationDto[]> {
    const { photos, voiceNotes } = await this.media.findForObservations(observations.map((o) => o.id));
    return observations.map((observation) => this.mapper.toDto(
      observation,
      photos.filter((photo) => photo.observationId === observation.id),
      voiceNotes.find((note) => note.observationId === observation.id),
    ));
  }
}
