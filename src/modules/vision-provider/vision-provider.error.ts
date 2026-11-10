export type VisionProviderErrorCode = 'request_failed' | 'invalid_response' | 'timeout';

/** Typed failure; be-recognition maps it to unsure with unsureReason "provider_error". */
export class VisionProviderError extends Error {
  constructor(readonly code: VisionProviderErrorCode, message: string, readonly attempts: number) {
    super(message);
    this.name = 'VisionProviderError';
  }
}
