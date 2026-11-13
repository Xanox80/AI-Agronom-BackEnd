import { rateLimitOf, VisionProviderError } from './vision-provider.error';

describe('VisionProviderError', () => {
  it.each([429, 500, 503])('treats HTTP %i as retryable', (status) => {
    expect(new VisionProviderError('request_failed', 'x', 1, status).retryable).toBe(true);
  });

  it.each([400, 401, 403, 404])('treats HTTP %i as final', (status) => {
    expect(new VisionProviderError('request_failed', 'x', 1, status).retryable).toBe(false);
  });

  it('treats a failure without HTTP status (network) as retryable', () => {
    expect(new VisionProviderError('request_failed', 'x', 1).retryable).toBe(true);
  });

  it('treats a spent daily quota as final', () => {
    expect(new VisionProviderError('request_failed', 'x', 1, 429, { dailyQuotaExhausted: true }).retryable).toBe(false);
  });

  it('treats timeouts and invalid responses as retryable', () => {
    expect(new VisionProviderError('timeout', 'x', 1).retryable).toBe(true);
    expect(new VisionProviderError('invalid_response', 'x', 1).retryable).toBe(true);
  });
});

describe('rateLimitOf', () => {
  it('is undefined when no failure was a 429', () => {
    expect(rateLimitOf([new Error('boom'), new VisionProviderError('request_failed', 'x', 1, 503)])).toBeUndefined();
  });

  it('takes the longest requested delay and any spent daily quota', () => {
    expect(rateLimitOf([
      new VisionProviderError('request_failed', 'x', 1, 429, { retryAfterMs: 2000 }),
      new VisionProviderError('request_failed', 'x', 1, 429, { retryAfterMs: 9000, dailyQuotaExhausted: true }),
    ])).toEqual({ retryAfterMs: 9000, dailyQuotaExhausted: true });
  });
});
