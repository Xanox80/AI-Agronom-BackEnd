const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses `15m`, `2h`, `30d` or bare seconds into seconds. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}"`);
  return Number(match[1]) * SECONDS_PER_UNIT[match[2] || 's'];
}
