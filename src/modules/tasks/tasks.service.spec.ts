import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, TaskPriority, TaskStatus, TaskType } from '../../domain/enums';
import { TaskActor } from './task-actor';
import { DRAFT_STATUS } from './tasks.constants';
import { TasksService } from './tasks.service';
import { TasksSettings } from './tasks.settings';

const FARM = 'farm-1';
const chief: TaskActor = { id: 'chief-1', farmId: FARM, role: Role.ChiefAgronomist };
const mechanic: TaskActor = { id: 'mech-1', farmId: FARM, role: Role.Mechanic };

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1', clientId: 't1', farmId: FARM, type: TaskType.Treatment, fieldId: 'f1', status: TaskStatus.Open,
    assigneeUserId: 'mech-1', createdByUserId: 'chief-1', photoIds: [], ...overrides,
  };
}

function build(existing: ReturnType<typeof task> | null = task()) {
  const tasks = {
    findOne: jest.fn().mockResolvedValue(existing),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
    remove: jest.fn(),
  };
  const fieldAccess = { require: jest.fn().mockResolvedValue(undefined) };
  const references = { validate: jest.fn().mockResolvedValue(undefined), observationPhotoIds: jest.fn().mockResolvedValue(['p1']) };
  const settings = new TasksSettings({ get: () => undefined } as never);
  const manager = { getRepository: jest.fn(() => tasks) };
  const dataSource = { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) };
  const treatments = { record: jest.fn().mockResolvedValue({ id: 'tr1' }) };
  const presenter = { present: jest.fn(async (rows) => rows) };
  const events = { emit: jest.fn() };
  const service = new TasksService(
    tasks as never, fieldAccess as never, references as never, settings, dataSource as never, treatments as never, presenter as never,
    events as never,
  );
  return { service, tasks, fieldAccess, references, treatments, events, manager };
}

describe('TasksService', () => {
  it('returns the existing task when the clientId was already created', async () => {
    const { service, tasks } = build();
    await service.create(chief, { clientId: 't1', type: TaskType.Treatment, fieldId: 'f1', title: 'x' });
    expect(tasks.save).not.toHaveBeenCalled();
  });

  it('creates an open task with normal priority by default', async () => {
    const { service, tasks } = build(null);
    await service.create(chief, { clientId: 't2', type: TaskType.Sampling, fieldId: 'f1', title: 'x' });
    expect(tasks.save).toHaveBeenCalledWith(expect.objectContaining({
      status: TaskStatus.Open, priority: TaskPriority.Normal, createdByUserId: 'chief-1', farmId: FARM,
    }));
  });

  it('takes the photos of the linked observation', async () => {
    const { service, tasks } = build(null);
    await service.create(chief, { clientId: 't2', type: TaskType.Sampling, fieldId: 'f1', title: 'x', observationId: 'o1' });
    expect(tasks.save).toHaveBeenCalledWith(expect.objectContaining({ photoIds: ['p1'] }));
  });

  it('rejects creating a task for a field of another farm', async () => {
    const { service, fieldAccess } = build(null);
    fieldAccess.require.mockRejectedValue(new NotFoundException());
    await expect(service.create(chief, { clientId: 't2', type: TaskType.Sampling, fieldId: 'other', title: 'x' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a draft task when asked to', async () => {
    const { service, tasks } = build(null);
    await service.create(chief, { clientId: 't2', type: TaskType.Sampling, fieldId: 'f1', title: 'x', status: DRAFT_STATUS });
    expect(tasks.save).toHaveBeenCalledWith(expect.objectContaining({ status: DRAFT_STATUS }));
  });

  it('rejects a task whose references fail validation', async () => {
    const { service, references, tasks } = build(null);
    references.validate.mockRejectedValue(new BadRequestException());
    await expect(service.create(chief, { clientId: 't2', type: TaskType.Sampling, fieldId: 'f1', title: 'x', diagnosisId: 'd' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tasks.save).not.toHaveBeenCalled();
  });

  it('publishes a draft task by moving it to open', async () => {
    const { service } = build(task({ status: DRAFT_STATUS }));
    await expect(service.update(chief, 't1', { status: TaskStatus.Open })).resolves.toMatchObject({ status: TaskStatus.Open });
  });

  it('refuses to start a draft task directly', async () => {
    const { service } = build(task({ status: DRAFT_STATUS }));
    await expect(service.update(chief, 't1', { status: TaskStatus.InProgress })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restricts a mechanic list to tasks assigned to them', async () => {
    const { service, tasks } = build();
    await service.list(mechanic, { page: 1, pageSize: 20, assigneeId: 'someone-else' });
    expect(tasks.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { farmId: FARM, assigneeUserId: 'mech-1' },
    }));
  });

  it('filters the list by status, field and type', async () => {
    const { service, tasks } = build();
    await service.list(chief, { page: 2, pageSize: 10, status: TaskStatus.Open, fieldId: 'f1', type: TaskType.Reinspection });
    expect(tasks.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { farmId: FARM, status: TaskStatus.Open, fieldId: 'f1', type: TaskType.Reinspection }, skip: 10, take: 10,
    }));
  });

  it('hides a task from a mechanic who is not the assignee', async () => {
    const { service } = build(task({ assigneeUserId: 'someone-else' }));
    await expect(service.get(mechanic, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the assignee change only the status', async () => {
    const { service } = build();
    await expect(service.update(mechanic, 't1', { status: TaskStatus.InProgress })).resolves.toMatchObject({ status: TaskStatus.InProgress });
    await expect(service.update(mechanic, 't1', { title: 'new' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to reopen a cancelled task', async () => {
    const { service } = build(task({ status: TaskStatus.Cancelled }));
    await expect(service.update(chief, 't1', { status: TaskStatus.Open })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to mark done through update', async () => {
    const { service } = build();
    await expect(service.update(chief, 't1', { status: TaskStatus.Done })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires treatment details to complete a treatment task', async () => {
    const { service } = build();
    await expect(service.complete(chief, 't1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes a treatment log entry and emits task.completed when a treatment task is completed', async () => {
    const { service, treatments, events } = build();
    const treatment = { productId: 'p1', doseValue: 1, doseUnit: 'l/ha', treatedAreaHa: 10, appliedAt: '2026-06-01' };
    const result = await service.complete(chief, 't1', { treatment });
    expect(treatments.record).toHaveBeenCalledWith(chief, expect.objectContaining({ ...treatment, fieldId: 'f1', taskId: 't1' }), expect.anything());
    expect(result).toMatchObject({ status: TaskStatus.Done });
    expect(events.emit).toHaveBeenCalledWith('task.completed', expect.objectContaining({ taskId: 't1', treatmentId: 'tr1' }));
  });

  it('completes a non-treatment task without a treatment log entry', async () => {
    const { service, treatments } = build(task({ type: TaskType.Sampling }));
    await service.complete(chief, 't1', {});
    expect(treatments.record).not.toHaveBeenCalled();
  });

  it('does nothing when completing an already done task', async () => {
    const { service, tasks, treatments } = build(task({ status: TaskStatus.Done }));
    await service.complete(chief, 't1', {});
    expect(tasks.save).not.toHaveBeenCalled();
    expect(treatments.record).not.toHaveBeenCalled();
  });
});
