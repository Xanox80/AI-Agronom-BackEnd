import { seasonStartDate } from './season';

describe('seasonStartDate', () => {
  it('starts the season in the current year once the start month has begun', () => {
    expect(seasonStartDate(new Date('2026-06-10T00:00:00Z'), 3)).toBe('2026-03-01');
  });

  it('uses the previous year before the start month', () => {
    expect(seasonStartDate(new Date('2026-01-15T00:00:00Z'), 3)).toBe('2025-03-01');
  });

  it('counts the start month itself as in the new season', () => {
    expect(seasonStartDate(new Date('2026-03-01T00:00:00Z'), 3)).toBe('2026-03-01');
  });
});
