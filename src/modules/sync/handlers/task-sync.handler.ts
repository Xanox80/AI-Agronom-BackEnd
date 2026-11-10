import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { TaskEntity, UserEntity } from '../../../domain/entities';
import { Role, SyncEntityType, TaskPriority, TaskStatus } from '../../../domain/enums';
import { FieldAccess } from '../../tasks/field-access';
import { TaskReferences } from '../../tasks/task-references';
import { TaskPayloadDto } from '../dto/payloads.dto';
import { SyncChange, SyncContext, optionalDate } from './entity-sync-handler';
import { OfflineRowHandler } from './offline-row.handler';

@Injectable()
export class TaskSyncHandler extends OfflineRowHandler<TaskEntity, TaskPayloadDto> {
  readonly entityType = SyncEntityType.Task;
  readonly roles = [Role.Scout, Role.ChiefAgronomist];
  protected readonly payloadClass = TaskPayloadDto;

  constructor(
    @InjectRepository(TaskEntity) repo: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly fieldAccess: FieldAccess,
    private readonly references: TaskReferences,
  ) {
    super(repo);
  }

  protected async assertReferencesAllowed(ctx: SyncContext, p: TaskPayloadDto): Promise<void> {
    await this.fieldAccess.require(ctx.farmId, p.fieldId);
    await this.references.validate(ctx.farmId, p);
    if (p.assigneeUserId && !(await this.users.exist({ where: { id: p.assigneeUserId, farmId: ctx.farmId } }))) {
      throw new BadRequestException('Unknown assigneeUserId');
    }
  }

  protected build(ctx: SyncContext, change: SyncChange, p: TaskPayloadDto): DeepPartial<TaskEntity> {
    return {
      id: change.clientId, clientId: change.clientId, farmId: ctx.farmId, createdByUserId: ctx.userId,
      type: p.type, fieldId: p.fieldId, title: p.title, notes: p.notes ?? '', observationId: p.observationId ?? null,
      lat: p.lat ?? null, lng: p.lng ?? null, diagnosisId: p.diagnosisId ?? null, recommendationId: p.recommendationId ?? null,
      photoIds: p.photoIds ?? [], priority: p.priority ?? TaskPriority.Normal, status: p.status ?? TaskStatus.Open,
      assigneeUserId: p.assigneeUserId ?? null, deadline: optionalDate(p.deadline),
      clientCreatedAt: optionalDate(p.clientCreatedAt) ?? change.clientTimestamp,
    };
  }

  protected edit(row: TaskEntity, p: TaskPayloadDto): void {
    row.title = p.title;
    row.notes = p.notes ?? row.notes;
    row.priority = p.priority ?? row.priority;
    row.status = p.status ?? row.status;
    row.assigneeUserId = p.assigneeUserId ?? row.assigneeUserId;
    row.deadline = p.deadline ? new Date(p.deadline) : row.deadline;
    row.fieldId = p.fieldId;
  }

  protected ownerId(row: TaskEntity): string { return row.createdByUserId; }
}
