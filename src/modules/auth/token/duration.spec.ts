import { durationToSeconds } from './duration';

describe('durationToSeconds', () => {
  it.each([['15m', 900], ['2h', 7200], ['30d', 2592000], ['45s', 45], ['60', 60]])('parses %s', (input, seconds) => {
    expect(durationToSeconds(input)).toBe(seconds);
  });

  it('rejects an invalid duration', () => {
    expect(() => durationToSeconds('soon')).toThrow('Invalid duration');
  });
});
