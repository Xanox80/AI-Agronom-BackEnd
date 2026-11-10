import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { And, FindOptionsWhere, In, IsNull, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import {
  DiagnosisHypothesisEntity, DiagnosisResultEntity, FieldEntity, ObservationEntity, PhotoEntity, RecommendationEntity,
  SyncRecordEntity, TaskEntity, TenantEntity, TreatmentEntity,
} from '../../domain/entities';
import { Role, SyncEntityType, SyncOperation, SyncStatus } from '../../domain/enums';
import { PullResponse } from './dto/pull.dto';
import { SyncActor } from './handlers/entity-sync-handler';
import { PullCursor, PulledType, decodeCursor, encodeCursor } from './pull-cursor';
import { SyncSettings } from './sync.settings';
import {
  toSyncDiagnosis, toSyncField, toSyncObservation, toSyncRecommendation, toSyncTask, toSyncTreatment,
} from './pull-mappers';

const MS_PER_SECOND = 1000;
export const PULL_MARKER_ENTITY_TYPE = 'pull_marker';

interface PullWindow { after?: Date; until: Date; cursor: PullCursor }
interface Slice<E> { rows: E[]; more: boolean }

/** Delta pull since a cursor (the previous `serverTime`); refined diagnoses (FR-26) arrive here. */
@Injectable()
export class SyncPullService {
  private readonly photoUrlPrefix: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly settings: SyncSettings,
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(TreatmentEntity) private readonly treatments: Repository<TreatmentEntity>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly diagnoses: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    @InjectRepository(RecommendationEntity) private readonly recommendations: Repository<RecommendationEntity>,
    @InjectRepository(SyncRecordEntity) private readonly records: Repository<SyncRecordEntity>,
  ) {
    this.photoUrlPrefix = `/${config.get('app', { infer: true }).apiPrefix}/photos`;
  }

  async lastPullAt(farmId: string, deviceId: string): Promise<Date | undefined> {
    const marker = await this.records.findOneBy({ farmId, deviceId, entityType: PULL_MARKER_ENTITY_TYPE });
    return marker?.appliedAt;
  }

  async pull(actor: SyncActor, deviceId: string, since?: string, token?: string): Promise<PullResponse> {
    const cursor = token ? decodeCursor(token) : { until: new Date().toISOString(), after: {} };
    const window: PullWindow = { after: since ? this.cursorLowerBound(new Date(since)) : undefined, until: new Date(cursor.until), cursor };
    const farmWhere = { farmId: actor.farmId };
    const [fields, tasks, treatments, observations, diagnoses, recommendations, deleted] = await Promise.all([
      this.slice('fields', this.fields, { ...farmWhere, deletedAt: IsNull() }, window),
      this.slice('tasks', this.tasks, this.taskScope(actor), window),
      this.slice('treatments', this.treatments, farmWhere, window),
      this.slice('observations', this.observations, farmWhere, window),
      this.slice('diagnoses', this.diagnoses, farmWhere, window),
      this.slice('recommendations', this.recommendations, farmWhere, window),
      this.deletedSince(actor.farmId, window.after),
    ]);
    const slices = { fields, tasks, treatments, observations, diagnoses, recommendations };
    const nextCursor = this.nextCursor(slices, cursor);
    if (!nextCursor) await this.markPulled(actor, deviceId, window.until);
    return {
      serverTime: window.until.toISOString(),
      changes: {
        fields: fields.rows.map(toSyncField), tasks: tasks.rows.map(toSyncTask), treatments: treatments.rows.map(toSyncTreatment),
        observations: await this.withPhotos(observations.rows), diagnoses: await this.withHypotheses(diagnoses.rows),
        recommendations: recommendations.rows.map(toSyncRecommendation),
      },
      deleted,
      nextCursor,
    };
  }

  private nextCursor(slices: Record<PulledType, Slice<TenantEntity>>, cursor: PullCursor): string | undefined {
    const types = Object.keys(slices) as PulledType[];
    if (!types.some((type) => slices[type].more)) return undefined;
    const after = { ...cursor.after };
    for (const type of types) after[type] = slices[type].rows.at(-1)?.id ?? after[type];
    return encodeCursor({ until: cursor.until, after });
  }

  private async markPulled(actor: SyncActor, deviceId: string, at: Date): Promise<void> {
    const key = { deviceId, entityType: PULL_MARKER_ENTITY_TYPE, clientId: PULL_MARKER_ENTITY_TYPE };
    const marker = await this.records.findOneBy(key) ?? this.records.create({
      ...key, serverId: PULL_MARKER_ENTITY_TYPE, operation: SyncOperation.Upsert, status: SyncStatus.Applied, clientTimestamp: at,
    });
    Object.assign(marker, { farmId: actor.farmId, userId: actor.userId, appliedAt: at });
    await this.records.save(marker);
  }

  /**
   * shortcut: SQLite `updatedAt` has one-second precision, so the cursor is widened below its second;
   * clients upsert by id, so a re-delivered row is harmless.
   */
  private cursorLowerBound(since: Date): Date {
    return new Date(Math.floor(since.getTime() / MS_PER_SECOND) * MS_PER_SECOND - 1);
  }

  /** Keyset page by id inside the frozen window, so rows changing mid-pull cannot shift or skip neighbours. */
  private async slice<E extends TenantEntity>(
    type: PulledType, repo: Repository<E>, where: FindOptionsWhere<E>[] | FindOptionsWhere<E>, window: PullWindow,
  ): Promise<Slice<E>> {
    const lastId = window.cursor.after[type];
    const upper = LessThanOrEqual(window.until);
    const clause = { updatedAt: window.after ? And(MoreThan(window.after), upper) : upper, ...(lastId ? { id: MoreThan(lastId) } : {}) };
    const scoped = (base: FindOptionsWhere<E>) => ({ ...base, ...clause }) as FindOptionsWhere<E>;
    const pageSize = this.settings.pullPageSize;
    const rows = await repo.find({
      where: Array.isArray(where) ? where.map(scoped) : scoped(where), order: { id: 'ASC' } as never, take: pageSize + 1,
    });
    return { rows: rows.slice(0, pageSize), more: rows.length > pageSize };
  }

  private taskScope(actor: SyncActor): FindOptionsWhere<TaskEntity>[] | FindOptionsWhere<TaskEntity> {
    const farm = { farmId: actor.farmId };
    if (actor.role !== Role.Mechanic) return farm;
    return [{ ...farm, assigneeUserId: actor.userId }, { ...farm, createdByUserId: actor.userId }];
  }

  private async withPhotos(rows: ObservationEntity[]) {
    const photos = rows.length ? await this.photos.find({ where: { observationId: In(rows.map((r) => r.id)) }, order: { seq: 'ASC' } }) : [];
    return rows.map((row) => toSyncObservation(row, photos.filter((p) => p.observationId === row.id), this.photoUrlPrefix));
  }

  private async withHypotheses(rows: DiagnosisResultEntity[]) {
    const hypotheses = rows.length
      ? await this.hypotheses.find({ where: { diagnosisResultId: In(rows.map((r) => r.id)) }, order: { rank: 'ASC' } })
      : [];
    return rows.map((row) => toSyncDiagnosis(row, hypotheses.filter((h) => h.diagnosisResultId === row.id)));
  }

  private async deletedSince(farmId: string, after?: Date): Promise<Record<string, string[]>> {
    const removedFields = await this.fields.find({
      where: { farmId, deletedAt: after ? MoreThan(after) : Not(IsNull()) },
    });
    const deletions = await this.records.find({
      where: { farmId, operation: SyncOperation.Delete, status: SyncStatus.Applied, ...(after ? { appliedAt: MoreThan(after) } : {}) },
    });
    const byType: Record<string, string[]> = { [SyncEntityType.Field]: removedFields.map((f) => f.id) };
    for (const record of deletions) (byType[record.entityType] ??= []).push(record.serverId);
    byType[SyncEntityType.Field] = [...new Set(byType[SyncEntityType.Field])];
    return byType;
  }
}
