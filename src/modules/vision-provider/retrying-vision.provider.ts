import { AppConfig } from '../../config/app-config';
import { RetryHint, VisionProviderError, VisionProviderErrorCode } from './vision-provider.error';
import { InvalidVisionResponseError } from './vision-response.parser';
import { VisionInput, VisionOutput, VisionProvider } from './vision.types';

const INVALID_RESPONSE_RETRIES = 1;
const TIMEOUT_PATTERN = /timeout|timed out|abort/i;
const HTTP_TOO_MANY_REQUESTS = 429;

/** Shared retry, backoff and error mapping for remote vision models; subclasses only send one request. */
export abstract class RetryingVisionProvider implements VisionProvider {
  abstract readonly name: string;
  abstract readonly model: string;
  protected abstract readonly displayName: string;

  constructor(protected readonly config: AppConfig['ai'], protected readonly maxHypotheses: number) {}

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const attempts = this.config.maxRetries + 1;
    let invalidResponses = 0;
    let last: VisionProviderError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.requestOnce(input);
      } catch (error) {
        last = this.toProviderError(error, attempt);
        if (!last.retryable || (last.code === 'invalid_response' && ++invalidResponses > INVALID_RESPONSE_RETRIES)) break;
        if (attempt < attempts) await this.backoff(attempt, last);
      }
    }
    throw last;
  }

  protected abstract requestOnce(input: VisionInput): Promise<VisionOutput>;

  /** Reads when to retry from a 429 response; the raw error is never kept because it may echo request data. */
  protected abstract retryHintOf(error: unknown, message: string): RetryHint;

  protected parseJson(text: string | null | undefined): unknown {
    try {
      return JSON.parse(text ?? '');
    } catch {
      throw new InvalidVisionResponseError('response is not valid JSON');
    }
  }

  /** Waits the delay the provider asked for on 429, else exponentially; capped so a request never hangs for minutes. */
  private backoff(attempt: number, error: VisionProviderError): Promise<void> {
    const requested = error.hint.retryAfterMs ?? this.config.retryBaseDelayMs * 2 ** (attempt - 1);
    const delayMs = Math.min(requested, this.config.retryMaxDelayMs);
    return delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  }

  private toProviderError(error: unknown, attempts: number): VisionProviderError {
    const invalid = error instanceof InvalidVisionResponseError;
    const message = error instanceof Error ? error.message : 'unknown error';
    const code: VisionProviderErrorCode = invalid ? 'invalid_response' : TIMEOUT_PATTERN.test(message) ? 'timeout' : 'request_failed';
    const httpStatus = invalid ? undefined : httpStatusOf(error);
    const name = error instanceof Error ? error.name : 'error';
    const summary = invalid ? message : `${this.displayName} request failed: ${name}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`;
    const hint = httpStatus === HTTP_TOO_MANY_REQUESTS ? this.retryHintOf(error, message) : {};
    return new VisionProviderError(code, summary, attempts, httpStatus, hint);
  }
}

/** SDK errors carry the HTTP status; their message may echo request data, so only the number is kept. */
function httpStatusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}
