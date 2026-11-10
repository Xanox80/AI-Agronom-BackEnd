import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { DomainEvent, TaskCompletedEvent } from '../../domain/events';
import { TaskEntity } from '../../domain/entities';
import { Role, TaskPriority, TaskStatus, TaskType } from '../../domain/enums';
import type { Page } from '../../domain/types';
import { CompleteTaskDto, CreateTaskDto, UpdateTaskDto } from './dto/task-input.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { FieldAccess } from './field-access';
import { TaskActor } from './task-actor';
import { TaskPresenter } from './task-presenter';
import { TaskReferences } from './task-references';
import { STATUS_TRANSITIONS } from './tasks.constants';
import { TasksSettings } from './tasks.settings';
import { TreatmentsService } from './treatments.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    private readonly fieldAccess: FieldAccess,
    private readonly references: TaskReferences,
    private readonly settings: TasksSettings,
    private readonly dataSource: DataSource,
    private readonly treatments: TreatmentsService,
    private readonly presenter: TaskPresenter,
    private readonly events: EventEmitter2,
  ) {}

  async list(actor: TaskActor, query: TaskQueryDto): Promise<Page<TaskResponseDto>> {
    const where: FindOptionsWhere<TaskEntity> = { farmId: actor.farmId };
    if (query.status) where.status = query.status;
    if (query.fieldId) where.fieldId = query.fieldId;
    if (query.type) where.type = query.type;
    const assignee = actor.role === Role.Mechanic ? actor.id : query.assigneeId;
    if (assignee) where.assigneeUserId = assignee;
    const { page, pageSize, skip } = this.settings.pageWindow(query);
    const [rows, total] = await this.tasks.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take: pageSize });
    return { items: await this.presenter.present(rows), total, page, pageSize };
  }

  async get(actor: TaskActor, id: string): Promise<TaskResponseDto> {
    return (await this.presenter.present([await this.load(actor, id)]))[0];
  }

  async create(actor: TaskActor, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const existing = await this.tasks.findOne({ where: { clientId: dto.clientId, farmId: actor.farmId } });
    if (existing) return (await this.presenter.present([existing]))[0];
    await this.fieldAccess.require(actor.farmId, dto.fieldId);
    await this.references.validate(actor.farmId, dto);
    const photoIds = dto.photoIds ?? (dto.observationId ? await this.references.observationPhotoIds(dto.observationId) : []);
    const saved = await this.tasks.save(this.tasks.create({
      id: dto.clientId, clientId: dto.clientId, farmId: actor.farmId, type: dto.type, fieldId: dto.fieldId,
      observationId: dto.observationId ?? null, lat: dto.lat ?? null, lng: dto.lng ?? null,
      diagnosisId: dto.diagnosisId ?? null, recommendationId: dto.recommendationId ?? null,
      photoIds, priority: dto.priority ?? TaskPriority.Normal, assigneeUserId: dto.assigneeUserId ?? null,
      createdByUserId: actor.id, deadline: dto.deadline ? new Date(dto.deadline) : null, status: dto.status ?? TaskStatus.Open,
      title: dto.title, notes: dto.notes ?? '', completedAt: null,
      clientCreatedAt: dto.clientCreatedAt ? new Date(dto.clientCreatedAt) : null,
    }));
    return (await this.presenter.present([saved]))[0];
  }

  async update(actor: TaskActor, id: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const task = await this.load(actor, id);
    this.assertMayEdit(actor, task, dto);
    if (dto.status === TaskStatus.Done) throw new BadRequestException('Use POST /tasks/:id/complete to finish a task');
    if (dto.status !== undefined) this.assertTransition(task.status, dto.status);
    if (dto.fieldId) await this.fieldAccess.require(actor.farmId, dto.fieldId);
    const { deadline, ...rest } = dto;
    Object.assign(task, rest);
    if (deadline !== undefined) task.deadline = new Date(deadline);
    return (await this.presenter.present([await this.tasks.save(task)]))[0];
  }

  async complete(actor: TaskActor, id: string, dto: CompleteTaskDto): Promise<TaskResponseDto> {
    const task = await this.load(actor, id);
    if (task.status === TaskStatus.Done) return (await this.presenter.present([task]))[0];
    this.assertTransition(task.status, TaskStatus.Done);
    const needsTreatment = task.type === TaskType.Treatment;
    if (needsTreatment && !dto.treatment) throw new BadRequestException('A treatment task needs treatment details to complete');
    task.status = TaskStatus.Done;
    task.completedAt = new Date();
    const { saved, treatment } = await this.dataSource.transaction(async (manager) => {
      const logged = needsTreatment
        ? await this.treatments.record(actor, { ...dto.treatment!, clientId: task.id, fieldId: task.fieldId, taskId: task.id }, manager)
        : undefined;
      return { saved: await manager.getRepository(TaskEntity).save(task), treatment: logged };
    });
    const event: TaskCompletedEvent = { taskId: saved.id, farmId: saved.farmId, fieldId: saved.fieldId, treatmentId: treatment?.id };
    this.events.emit(DomainEvent.TaskCompleted, event);
    return (await this.presenter.present([saved]))[0];
  }

  async remove(actor: TaskActor, id: string): Promise<void> {
    await this.tasks.remove(await this.load(actor, id));
  }

  private async load(actor: TaskActor, id: string): Promise<TaskEntity> {
    const task = await this.tasks.findOne({ where: { id, farmId: actor.farmId } });
    if (!task || (actor.role === Role.Mechanic && task.assigneeUserId !== actor.id)) throw new NotFoundException('Task not found');
    return task;
  }

  private assertTransition(from: TaskStatus, to: TaskStatus): void {
    if (from !== to && !STATUS_TRANSITIONS[from].includes(to)) throw new BadRequestException(`Cannot move task from ${from} to ${to}`);
  }

  private assertMayEdit(actor: TaskActor, task: TaskEntity, dto: UpdateTaskDto): void {
    const isAssignee = task.assigneeUserId === actor.id;
    const statusOnly = Object.keys(dto).every((k) => k === 'status');
    const isOwnScoutTask = actor.role === Role.Scout && task.createdByUserId === actor.id;
    if (actor.role === Role.ChiefAgronomist || (isAssignee && statusOnly) || isOwnScoutTask) return;
    throw new ForbiddenException('Not allowed to edit this task');
  }
}
