import { decodeCursor, encodeCursor } from './pull-cursor';

describe('pull cursor', () => {
  it('round-trips through its opaque token', () => {
    const cursor = { until: '2026-11-10T08:00:00.000Z', after: { tasks: 'abc' } };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects a token that is not a cursor', () => {
    expect(() => decodeCursor('garbage')).toThrow(/invalid pull cursor/);
    expect(() => decodeCursor(encodeCursor({ until: 'nope', after: {} }))).toThrow(/invalid pull cursor/);
  });
});
