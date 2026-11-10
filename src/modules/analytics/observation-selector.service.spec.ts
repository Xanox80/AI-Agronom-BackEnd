import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsSettings } from './analytics.settings';
import { ObservationSelector } from './observation-selector.service';

describe('ObservationSelector', () => {
  const MAX_ROWS = 2;
  const config = { get: () => ({ seasonStartMonth: 3 }) } as unknown as ConfigService<never, true>;

  const build = (rows: Array<{ id: string }>, diagnoses: Map<string, { id: string }>) => {
    const observations = { find: jest.fn().mockResolvedValue(rows) };
    const fields = { find: jest.fn().mockResolvedValue([{ id: 'f1', name: 'North' }]) };
    const resolver = { resolve: jest.fn().mockResolvedValue(diagnoses) };
    const selector = new ObservationSelector(
      observations as never, fields as never, resolver as never, config as never, { maxRows: MAX_ROWS } as AnalyticsSettings,
    );
    return { selector, observations, fields };
  };

  it('scopes the query to the farm and applies field, crop and inclusive date filters', async () => {
    const { selector, observations } = build([], new Map());
    await selector.select('farm', { fieldId: 'f1', cropId: 'c1', to: '2026-03-31' });
    const { where, take } = observations.find.mock.calls[0][0];
    expect(where).toMatchObject({ farmId: 'farm', fieldId: 'f1', cropId: 'c1' });
    expect(where.capturedAt.value.toISOString()).toBe('2026-03-31T23:59:59.999Z');
    expect(take).toBe(MAX_ROWS + 1);
  });

  it('keeps only observations whose resolved diagnosis matches diagnosisId', async () => {
    const { selector } = build([{ id: 'o1' }, { id: 'o2' }], new Map([['o1', { id: 'd1' }], ['o2', { id: 'd2' }]]));
    const selected = await selector.select('farm', { diagnosisId: 'd1' });
    expect(selected.map(({ observation }) => observation.id)).toEqual(['o1']);
  });

  it('rejects a selection above the row cap', async () => {
    const { selector } = build([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Map());
    await expect(selector.select('farm', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loads fields of the farm by id and skips the query for no ids', async () => {
    const { selector, fields } = build([], new Map());
    expect([...(await selector.fieldsById('farm', ['f1'])).keys()]).toEqual(['f1']);
    expect((await selector.fieldsById('farm', [])).size).toBe(0);
    expect(fields.find).toHaveBeenCalledTimes(1);
  });
});
