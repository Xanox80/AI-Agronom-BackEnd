const ISO_DATE_LENGTH = 10;
export const MS_PER_DAY = 86_400_000;

/** First day (ISO date) of the season that contains `today`; seasons start on the first of `startMonth`. */
export function seasonStartDate(today: Date, startMonth: number): string {
  const year = today.getUTCMonth() + 1 >= startMonth ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, startMonth - 1, 1)).toISOString().slice(0, ISO_DATE_LENGTH);
}
