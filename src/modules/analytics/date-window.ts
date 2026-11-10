import { Between, FindOperator, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';

export interface DateWindow { from?: Date; to?: Date }

const ONE_MS = 1;
const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A date-only upper bound covers the whole day, so `to=2026-03-31` includes captures made on the 31st. */
const upperBound = (value: string): Date => {
  const date = new Date(value);
  return DATE_ONLY.test(value) ? new Date(date.getTime() + MS_PER_DAY - ONE_MS) : date;
};

/** Explicit from/to win over the season, which spans one year from the configured start month. */
export function resolveDateWindow(filter: AnalyticsFilterDto, seasonStartMonth: number): DateWindow {
  const seasonFrom = filter.season === undefined ? undefined : new Date(Date.UTC(filter.season, seasonStartMonth - 1, 1));
  const seasonTo = filter.season === undefined ? undefined
    : new Date(Date.UTC(filter.season + 1, seasonStartMonth - 1, 1) - ONE_MS);
  return {
    from: filter.from ? new Date(filter.from) : seasonFrom,
    to: filter.to ? upperBound(filter.to) : seasonTo,
  };
}

export function dateRangeOperator<T>(window: DateWindow, convert: (date: Date) => T): FindOperator<T> | undefined {
  if (window.from && window.to) return Between(convert(window.from), convert(window.to));
  if (window.from) return MoreThanOrEqual(convert(window.from));
  if (window.to) return LessThanOrEqual(convert(window.to));
  return undefined;
}

export function weekStart(date: Date): string {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(dayStart - daysSinceMonday * MS_PER_DAY).toISOString().slice(0, 10);
}
