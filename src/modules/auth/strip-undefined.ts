/** Copies only the fields a PATCH body actually set, so a whitelist-less pipe can never write extra columns. */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
