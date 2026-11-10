import { TaskStatus } from '../../domain/enums';

/** FR-22 draft status; the shared TaskStatus enum has no member for it yet, the column is a plain varchar. */
export const DRAFT_STATUS = 'draft' as TaskStatus;

export const ISO_DATE_LENGTH = 10;

/** Allowed status moves; done and cancelled are terminal. */
export const STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [DRAFT_STATUS]: [TaskStatus.Open, TaskStatus.Cancelled],
  [TaskStatus.Open]: [TaskStatus.InProgress, TaskStatus.Done, TaskStatus.Cancelled],
  [TaskStatus.InProgress]: [TaskStatus.Open, TaskStatus.Done, TaskStatus.Cancelled],
  [TaskStatus.Done]: [],
  [TaskStatus.Cancelled]: [],
};

export const TASK_STATUSES: readonly TaskStatus[] = Object.keys(STATUS_TRANSITIONS) as TaskStatus[];
export const CREATABLE_STATUSES: readonly TaskStatus[] = [DRAFT_STATUS, TaskStatus.Open];
