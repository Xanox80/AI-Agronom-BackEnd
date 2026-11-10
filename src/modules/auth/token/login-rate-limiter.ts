import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthSettings } from '../auth.settings';

const MS_PER_SECOND = 1000;

/** In-memory failed-login counter per key; resets on restart (single-instance MVP). */
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly settings: AuthSettings) {}

  assertAllowed(key: string, maxAttempts: number = this.settings.auth.loginMaxAttempts): void {
    if (this.recent(key).length >= maxAttempts) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message: 'Too many login attempts', code: 'LOGIN_RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string): void {
    this.failures.set(key, [...this.recent(key), Date.now()]);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private recent(key: string): number[] {
    const since = Date.now() - this.settings.auth.loginWindowSeconds * MS_PER_SECOND;
    const kept = (this.failures.get(key) ?? []).filter((at) => at > since);
    if (kept.length) this.failures.set(key, kept);
    else this.failures.delete(key);
    return kept;
  }
}
