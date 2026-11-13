import { Injectable } from '@nestjs/common';
import { RecognitionService, RecognitionUnavailableError } from '../../recognition/recognition.service';
import { ObservationRefiner, RefinementThrottledError } from './observation-refiner';

/** Refinement through be-recognition: a `server_refined` diagnosis that the next pull delivers. */
@Injectable()
export class RecognitionObservationRefiner implements ObservationRefiner {
  constructor(private readonly recognition: RecognitionService) {}

  async refine(observationId: string, farmId: string, lastAttempt: boolean): Promise<void> {
    try {
      await this.recognition.refine(observationId, farmId, lastAttempt);
    } catch (error) {
      if (error instanceof RecognitionUnavailableError && error.rateLimit) {
        throw new RefinementThrottledError(error.rateLimit.retryAfterMs, !!error.rateLimit.dailyQuotaExhausted);
      }
      throw error;
    }
  }
}
