import { dateRangeOperator, resolveDateWindow, weekStart } from './date-window';

describe('date-window', () => {
  it('spans one year from the configured month for a season', () => {
    const window = resolveDateWindow({ season: 2026 }, 3);
    expect(window.from?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(window.to?.toISOString()).toBe('2027-02-28T23:59:59.999Z');
  });

  it('lets explicit from/to override the season bounds', () => {
    const window = resolveDateWindow({ season: 2026, from: '2026-05-01T00:00:00Z' }, 3);
    expect(window.from?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(window.to?.getUTCFullYear()).toBe(2027);
  });

  it('treats a date-only upper bound as the end of that day', () => {
    const window = resolveDateWindow({ from: '2026-03-01', to: '2026-03-31' }, 3);
    expect(window.from?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(window.to?.toISOString()).toBe('2026-03-31T23:59:59.999Z');
    expect(resolveDateWindow({ to: '2026-03-31T10:00:00Z' }, 3).to?.toISOString()).toBe('2026-03-31T10:00:00.000Z');
  });

  it('returns no bounds without filters', () => {
    expect(resolveDateWindow({}, 3)).toEqual({ from: undefined, to: undefined });
    expect(dateRangeOperator({}, (date) => date)).toBeUndefined();
  });

  it('finds the Monday of the week', () => {
    expect(weekStart(new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-09');
    expect(weekStart(new Date('2026-11-15T23:59:00Z'))).toBe('2026-11-09');
    expect(weekStart(new Date('2026-11-09T00:00:00Z'))).toBe('2026-11-09');
  });
});
