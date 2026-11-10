export type Env = Record<string, string | undefined>;

/** Typed, fail-fast access to environment variables (no schema library). */
export class EnvReader {
  constructor(private readonly env: Env) {}

  string(key: string, fallback: string): string {
    const value = this.env[key];
    return value === undefined || value === '' ? fallback : value;
  }

  required(key: string): string {
    const value = this.env[key];
    if (!value) throw new Error(`Missing required config key ${key}`);
    return value;
  }

  number(key: string, fallback: number): number {
    const raw = this.env[key];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) throw new Error(`Config key ${key} must be a number`);
    return parsed;
  }

  boolean(key: string, fallback: boolean): boolean {
    const raw = this.env[key];
    if (raw === undefined || raw === '') return fallback;
    return raw.toLowerCase() === 'true';
  }

  list(key: string, fallback: string[]): string[] {
    const raw = this.env[key];
    if (raw === undefined || raw === '') return fallback;
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  oneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const value = this.string(key, fallback);
    if (!allowed.includes(value as T)) throw new Error(`Config key ${key} must be one of ${allowed.join(', ')}`);
    return value as T;
  }
}
