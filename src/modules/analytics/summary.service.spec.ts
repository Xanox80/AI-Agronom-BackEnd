import { ObservationEntity } from '../../domain/entities';
import { ObservationSelector, ResolvedObservation } from './observation-selector.service';
import { SummaryService } from './summary.service';

const item = (id: string, capturedAt: string, code: string | null, fieldId: string | null = 'f1'): ResolvedObservation => ({
  observation: { id, fieldId, capturedAt: new Date(capturedAt) } as ObservationEntity,
  diagnosis: code ? { id: code, code, name: code.toUpperCase(), weight: 1, problemCategory: null } : null,
});

describe('SummaryService', () => {
  it('counts observations by diagnosis, field and week', async () => {
    const selector = {
      select: jest.fn().mockResolvedValue([
        item('1', '2026-11-09T10:00:00Z', 'rust'),
        item('2', '2026-11-12T10:00:00Z', 'rust'),
        item('3', '2026-11-18T10:00:00Z', 'aphid', 'f2'),
        item('4', '2026-11-18T11:00:00Z', null, null),
      ]),
      fieldsById: jest.fn().mockResolvedValue(new Map([['f1', { name: 'North' }]])),
    } as unknown as ObservationSelector;

    const summary = await new SummaryService(selector).build('farm', {});

    expect(summary.total).toBe(4);
    expect(summary.byDiagnosis).toEqual([{ code: 'rust', name: 'RUST', count: 2 }, { code: 'aphid', name: 'APHID', count: 1 }]);
    expect(summary.byField).toEqual([{ fieldId: 'f1', name: 'North', count: 2 }, { fieldId: 'f2', name: 'f2', count: 1 }]);
    expect(summary.byWeek).toEqual([{ week: '2026-11-09', count: 2 }, { week: '2026-11-16', count: 2 }]);
  });
});
