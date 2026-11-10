import { DatasetService } from './dataset.service';
import { buildExpertConfig } from './expert.config';

const repo = (rows: object[]) => ({ find: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(2) });

function build(labels: object[]) {
  return new DatasetService(
    repo(labels) as never, repo([]) as never,
    repo([{ id: 'o1', cropId: 'c1', bbchStage: 31, temperatureC: 18, humidityPct: 70, organ: 'leaf', capturedAt: new Date('2026-05-01T10:00:00Z') }]) as never,
    repo([{ id: 'p1', observationId: 'o1', seq: 1 }, { id: 'p2', observationId: 'o1', seq: 2 }]) as never,
    repo([{ id: 'd1', code: 'septoria' }]) as never, repo([{ id: 'c1', code: 'wheat_winter' }]) as never,
    buildExpertConfig({}),
  );
}

const label = { updatedAt: new Date('2026-05-02T00:00:00Z'), observationId: 'o1', diagnosisId: 'd1', weight: 3, inDataset: true, affectedRegion: { type: 'rect', photoSeq: 2, points: [] }, photoId: null };

describe('DatasetService', () => {
  it('exports a confirmed label with crop code, region and the photo its region refers to', async () => {
    const { records: [record] } = await build([label]).export();
    expect(record).toMatchObject({
      photoUrl: '/api/v1/photos/p2/file', diagnosisCode: 'septoria', weight: 3, cropCode: 'wheat_winter', bbch: 31,
    });
    expect(record.context.capturedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('skips labels whose diagnosis is not in the catalogue', async () => {
    const { records, manifest } = await build([{ ...label, diagnosisId: 'missing' }]).export();
    expect(records).toEqual([]);
    expect(manifest).toMatchObject({ count: 0, skipped: 1 });
  });

  it('reads every page and reports count and the latest update in the manifest', async () => {
    const config = { ...buildExpertConfig({}), datasetPageSize: 2 };
    const pages = [[label, label], [{ ...label, updatedAt: new Date('2026-06-01T00:00:00Z') }]];
    const labels = { find: jest.fn(async () => pages.shift() ?? []) };
    const service = new DatasetService(
      labels as never, repo([]) as never, repo([{ id: 'o1', cropId: 'c1', capturedAt: new Date() }]) as never,
      repo([{ id: 'p1', observationId: 'o1', seq: 1 }]) as never, repo([{ id: 'd1', code: 'septoria' }]) as never,
      repo([{ id: 'c1', code: 'wheat' }]) as never, config,
    );
    const { manifest } = await service.export();
    expect(manifest).toMatchObject({ count: 3, skipped: 0, latestUpdatedAt: '2026-06-01T00:00:00.000Z' });
  });

  it('counts labels per diagnosis code and exportable labels', async () => {
    const stats = await build([label, { ...label, inDataset: false }]).stats();
    expect(stats).toMatchObject({ labeled: 2, exportableCount: 1, pendingReview: 2, byDiagnosis: [{ code: 'septoria', count: 2 }] });
  });
});
