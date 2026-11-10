import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogDiagnosisEntity, FieldEntity, TaskEntity, UserEntity } from '../../domain/entities';
import { AppConfig } from '../../config/app-config';
import { TaskResponseDto } from './dto/task-response.dto';

/** Maps task rows to TaskDto, resolving names with one batched lookup per kind. */
@Injectable()
export class TaskPresenter {
  constructor(
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async present(tasks: TaskEntity[]): Promise<TaskResponseDto[]> {
    const fieldNames = await this.names(this.fields, tasks.map((t) => t.fieldId), (f) => f.name);
    const diagnosisNames = await this.names(this.diagnoses, tasks.map((t) => t.diagnosisId), (d) => d.nameUk);
    const userNames = await this.names(this.users, tasks.map((t) => t.assigneeUserId), (u) => u.displayName);
    const prefix = this.config.get('app', { infer: true }).apiPrefix;
    return tasks.map((t) => ({
      id: t.id, clientId: t.clientId, type: t.type, fieldId: t.fieldId, fieldName: fieldNames.get(t.fieldId),
      observationId: t.observationId ?? undefined, lat: t.lat ?? undefined, lng: t.lng ?? undefined,
      diagnosisId: t.diagnosisId ?? undefined, diagnosisName: t.diagnosisId ? diagnosisNames.get(t.diagnosisId) : undefined,
      recommendationId: t.recommendationId ?? undefined, photoUrls: t.photoIds.map((id) => `/${prefix}/photos/${id}/file`),
      priority: t.priority, assigneeUserId: t.assigneeUserId ?? undefined,
      assigneeName: t.assigneeUserId ? userNames.get(t.assigneeUserId) : undefined,
      deadline: t.deadline?.toISOString(), status: t.status, title: t.title, notes: t.notes,
      completedAt: t.completedAt?.toISOString(), createdAt: t.createdAt.toISOString(),
    }));
  }

  private async names<E extends { id: string }>(
    repo: Repository<E>, ids: (string | null)[], pick: (e: E) => string,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unique.length) return new Map();
    const rows = await repo.find({ where: { id: In(unique) } as never });
    return new Map(rows.map((r) => [r.id, pick(r)]));
  }
}
