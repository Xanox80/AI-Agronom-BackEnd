const HTTP_TOO_MANY_REQUESTS = 429;

export type VisionProviderErrorCode = 'request_failed' | 'invalid_response' | 'timeout';

/** What the provider said about when, if ever, the request may pass. */
export interface RetryHint {
  retryAfterMs?: number;
  dailyQuotaExhausted?: boolean;
}

/** Typed failure; be-recognition maps it to unsure with unsureReason "provider_error". */
export class VisionProviderError extends Error {
  constructor(
    readonly code: VisionProviderErrorCode,
    message: string,
    readonly attempts: number,
    readonly httpStatus?: number,
    readonly hint: RetryHint = {},
  ) {
    super(message);
    this.name = 'VisionProviderError';
  }

  get rateLimited(): boolean {
    return this.httpStatus === HTTP_TOO_MANY_REQUESTS;
  }

  /** Overload (429), server errors, timeouts and network failures can pass on a later attempt; other 4xx and a spent daily quota cannot. */
  get retryable(): boolean {
    if (this.hint.dailyQuotaExhausted) return false;
    if (this.code === 'invalid_response' || this.code === 'timeout' || this.httpStatus === undefined) return true;
    return this.rateLimited || this.httpStatus >= 500;
  }
}

/** Merges the 429 hints of failed calls: the longest requested delay wins, one spent daily quota stops all. */
export function rateLimitOf(failures: unknown[]): RetryHint | undefined {
  const limited = failures.filter((failure): failure is VisionProviderError => failure instanceof VisionProviderError && failure.rateLimited);
  if (!limited.length) return undefined;
  const delays = limited.map((error) => error.hint.retryAfterMs).filter((delay): delay is number => delay !== undefined);
  return {
    retryAfterMs: delays.length ? Math.max(...delays) : undefined,
    dailyQuotaExhausted: limited.some((error) => error.hint.dailyQuotaExhausted),
  };
}
