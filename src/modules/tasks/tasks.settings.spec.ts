import { TasksSettings } from './tasks.settings';

const settings = (env: Record<string, string> = {}) => new TasksSettings({ get: (k: string) => env[k] } as never);

describe('TasksSettings', () => {
  it('uses the configured page sizes', () => {
    const s = settings({ TASKS_DEFAULT_PAGE_SIZE: '5', TASKS_MAX_PAGE_SIZE: '8' });
    expect(s.pageWindow({})).toEqual({ page: 1, pageSize: 5, skip: 0 });
    expect(s.pageWindow({ page: 3, pageSize: 50 })).toEqual({ page: 3, pageSize: 8, skip: 16 });
  });

  it('falls back to defaults when the keys are missing', () => {
    expect(settings().pageWindow({}).pageSize).toBeGreaterThan(0);
  });
});
