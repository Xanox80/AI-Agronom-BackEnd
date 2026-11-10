import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../../config/app-config';
import { ObservationEntity, PhotoEntity, SyncRecordEntity } from '../../../domain/entities';
import { SyncEntityType } from '../../../domain/enums';
import { DomainEvent, PhotoUploadedEvent } from '../../../domain/events';
import { OBSERVATION_REFINER, ObservationRefiner } from './observation-refiner';
import { pendingRefinementQuery } from './pending-refinement';

/**
 * In-memory queue of server-side refinements for observations that arrived through sync (FR-26).
 * The database is the durable state: on start every observation still lacking a refined diagnosis is re-queued.
 */
@Injectable()
export class RefinementQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefinementQueueService.name);
  private readonly pending = new Map<string, string>();
  private readonly running = new Set<string>();
  private readonly concurrency: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(SyncRecordEntity) private readonly records: Repository<SyncRecordEntity>,
    @Optional() @Inject(OBSERVATION_REFINER) private readonly refiner?: ObservationRefiner,
  ) {
    this.concurrency = config.get('sync', { infer: true }).refineConcurrency;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.refiner) return;
    try {
      for (const row of await pendingRefinementQuery(this.observations).getMany()) this.enqueue(row.id, row.farmId);
    } catch (error) {
      this.logger.warn(`could not restore pending refinements: ${(error as Error).message}`);
    }
  }

  async scheduleWhenPhotosExist(observationId: string, farmId: string): Promise<void> {
    if (await this.photos.existsBy({ observationId, farmId })) this.enqueue(observationId, farmId);
  }

  @OnEvent(DomainEvent.PhotoUploaded)
  async onPhotoUploaded(event: PhotoUploadedEvent): Promise<void> {
    const cameFromSync = await this.records.existsBy({ entityType: SyncEntityType.Observation, serverId: event.observationId });
    if (cameFromSync) this.enqueue(event.observationId, event.farmId);
  }

  enqueue(observationId: string, farmId: string): void {
    if (!this.refiner) return;
    this.pending.set(observationId, farmId);
    this.drain();
  }

  private drain(): void {
    while (this.running.size < this.concurrency) {
      const next = [...this.pending].find(([observationId]) => !this.running.has(observationId));
      if (!next) return;
      this.pending.delete(next[0]);
      this.running.add(next[0]);
      void this.run(next[0], next[1]);
    }
  }

  private async run(observationId: string, farmId: string): Promise<void> {
    try {
      await this.refiner!.refine(observationId, farmId);
    } catch (error) {
      this.logger.warn(`refinement failed for observation ${observationId}: ${(error as Error).message}`);
    } finally {
      this.running.delete(observationId);
      this.drain();
    }
  }
}
