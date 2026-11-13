/** Implemented by be-recognition (pass `server_refined`, FR-26); sync only schedules it. */
export interface ObservationRefiner {
  refine(observationId: string, farmId: string, lastAttempt: boolean): Promise<void>;
}

export const OBSERVATION_REFINER = Symbol('OBSERVATION_REFINER');

/** The refiner's upstream is rate-limited: the whole queue pauses and the attempt is not counted. */
export class RefinementThrottledError extends Error {
  constructor(readonly retryAfterMs: number | undefined, readonly quotaExhausted: boolean) {
    super(quotaExhausted ? 'vision provider daily quota exhausted' : 'vision provider rate-limited');
    this.name = 'RefinementThrottledError';
  }
}
