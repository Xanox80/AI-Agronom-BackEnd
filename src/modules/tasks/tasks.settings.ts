import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PageWindow { page: number; pageSize: number; skip: number }

const FALLBACK_DEFAULT_PAGE_SIZE = 20;
const FALLBACK_MAX_PAGE_SIZE = 100;

/** Tunables of the tasks module, read from TASKS_* environment keys. */
@Injectable()
export class TasksSettings {
  constructor(private readonly config: ConfigService) {}

  get defaultPageSize(): number {
    return Number(this.config.get('TASKS_DEFAULT_PAGE_SIZE')) || FALLBACK_DEFAULT_PAGE_SIZE;
  }

  get maxPageSize(): number {
    return Number(this.config.get('TASKS_MAX_PAGE_SIZE')) || FALLBACK_MAX_PAGE_SIZE;
  }

  pageWindow(query: { page?: number; pageSize?: number }): PageWindow {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? this.defaultPageSize, this.maxPageSize);
    return { page, pageSize, skip: (page - 1) * pageSize };
  }
}
