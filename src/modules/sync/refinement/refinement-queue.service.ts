import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../../config/app-config';
import { ObservationEntity, PhotoEntity, SyncRecordEntity } from '../../../domain/entities';
import { SyncEntityType } from '../../../domain/enums';
import { DomainEvent, PhotoUploadedEvent } from '../../../domain/events';
import { OBSERVATION_REFINER, ObservationRefiner, RefinementThrottledError } from './observation-refiner';
import { pendingRefinementQuery } from './pending-refinement';

const MS_PER_SECOND = 1000;

/**
 * In-memory queue of server-side refinements for observations that arrived through sync (FR-26).
 * The database is the durable state: on start every observation still lacking a refined diagnosis is re-queued.
 * A failed refinement is retried with exponential backoff up to the configured number of attempts.
 */
@Injectable()
export class RefinementQueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RefinementQueueService.name);
  private readonly pending = new Map<string, string>();
  private readonly running = new Set<string>();
  private readonly failedAttempts = new Map<string, number>();
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();
  private readonly settings: AppConfig['sync'];
  private resumeTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService<AppConfig, true>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(SyncRecordEntity) private readonly records: Repository<SyncRecordEntity>,
    @Optional() @Inject(OBSERVATION_REFINER) private readonly refiner?: ObservationRefiner,
  ) {
    this.settings = config.get('sync', { infer: true });
  }

  onModuleDestroy(): void {
    this.retryTimers.forEach((timer) => clearTimeout(timer));
    this.retryTimers.clear();
    clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
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
    clearTimeout(this.retryTimers.get(observationId));
    this.retryTimers.delete(observationId);
    this.pending.set(observationId, farmId);
    this.drain();
  }

  private drain(): void {
    if (this.resumeTimer) return;
    while (this.running.size < this.settings.refineConcurrency) {
      const next = [...this.pending].find(([observationId]) => !this.running.has(observationId));
      if (!next) return;
      this.pending.delete(next[0]);
      this.running.add(next[0]);
      void this.run(next[0], next[1]);
    }
  }

  private async run(observationId: string, farmId: string): Promise<void> {
    const attempt = (this.failedAttempts.get(observationId) ?? 0) + 1;
    try {
      await this.refiner!.refine(observationId, farmId, attempt >= this.settings.refineMaxAttempts);
      this.failedAttempts.delete(observationId);
    } catch (error) {
      if (error instanceof RefinementThrottledError) {
        this.pending.set(observationId, farmId);
        this.pause(error);
      } else {
        this.logger.warn(`refinement failed for observation ${observationId} (attempt ${attempt}): ${(error as Error).message}`);
        this.retryLater(observationId, farmId, attempt);
      }
    } finally {
      this.running.delete(observationId);
      this.drain();
    }
  }

  /** One throttled refinement holds back the whole queue: every other one would hit the same limit. */
  private pause(error: RefinementThrottledError): void {
    if (this.resumeTimer) return;
    const delayMs = error.quotaExhausted
      ? this.settings.refineQuotaPauseMs
      : Math.max(error.retryAfterMs ?? 0, this.settings.refineRetryBaseMs);
    this.logger.warn(`${error.message}; refinement paused for ${Math.ceil(delayMs / MS_PER_SECOND)} s`);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      this.drain();
    }, delayMs);
    this.resumeTimer.unref();
  }

  private retryLater(observationId: string, farmId: string, attempt: number): void {
    if (attempt >= this.settings.refineMaxAttempts) {
      this.failedAttempts.delete(observationId);
      return;
    }
    this.failedAttempts.set(observationId, attempt);
    const delayMs = Math.min(this.settings.refineRetryBaseMs * 2 ** (attempt - 1), this.settings.refineRetryMaxMs);
    const timer = setTimeout(() => this.enqueue(observationId, farmId), delayMs);
    timer.unref();
    this.retryTimers.set(observationId, timer);
  }
}
