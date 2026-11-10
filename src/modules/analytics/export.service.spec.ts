import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsSettings } from './analytics.settings';
import { ExportMapper } from './export-mapper.service';
import { ExportService } from './export.service';
import { ObservationSelector } from './observation-selector.service';

describe('ExportService', () => {
  const PAGE_SIZE = 2;
  const MAX_ROWS = 2;
  const config = {
    get: (key: string) => (key === 'export' ? { pageSize: PAGE_SIZE } : { seasonStartMonth: 3 }),
  } as unknown as ConfigService<never, true>;

  const build = () => {
    const observationRows = { findAndCount: jest.fn().mockResolvedValue([[{ id: 'o1' }], 5]) };
    const fieldRows = { findAndCount: jest.fn().mockResolvedValue([[], 0]), find: jest.fn().mockResolvedValue([{ id: 'gone' }]) };
    const taskRows = { find: jest.fn() };
    const mapper = { fields: jest.fn().mockResolvedValue([]), observations: jest.fn().mockResolvedValue([{ externalIds: { scoutId: 'o1' } }]) };
    const service = new ExportService(
      fieldRows as never, observationRows as never, taskRows as never, {} as never,
      mapper as unknown as ExportMapper, {} as ObservationSelector, config as never, { maxRows: MAX_ROWS } as AnalyticsSettings,
    );
    return { service, observationRows, taskRows };
  };

  it('pages with the configured page size and reports the total', async () => {
    const { service, observationRows } = build();
    const page = await service.page('observations', 'farm', { page: 3 });
    expect(observationRows.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 4, take: PAGE_SIZE }));
    expect(page).toMatchObject({ total: 5, page: 3, pageSize: PAGE_SIZE });
    expect(page.items).toHaveLength(1);
  });

  it('restricts to the caller farm and filters by updatedSince', async () => {
    const { service, observationRows } = build();
    await service.page('observations', 'farm-1', { updatedSince: '2026-11-01T00:00:00Z' });
    const { where } = observationRows.findAndCount.mock.calls[0][0];
    expect(where.farmId).toBe('farm-1');
    expect(where.updatedAt).toBeDefined();
  });

  it('lists soft-deleted fields on incremental sync only', async () => {
    const { service } = build();
    expect((await service.page('fields', 'farm', {})).deleted).toEqual([]);
    expect((await service.page('fields', 'farm', { updatedSince: '2026-11-01T00:00:00Z' })).deleted).toEqual(['gone']);
  });

  it('rejects a selection above the row cap', async () => {
    const { service, taskRows } = build();
    taskRows.find.mockResolvedValue([{}, {}, {}]);
    await expect(service.tasks('farm', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(taskRows.find).toHaveBeenCalledWith(expect.objectContaining({ take: MAX_ROWS + 1 }));
  });
});
