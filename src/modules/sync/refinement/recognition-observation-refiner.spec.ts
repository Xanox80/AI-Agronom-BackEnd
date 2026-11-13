import { RecognitionService, RecognitionUnavailableError } from '../../recognition/recognition.service';
import { RefinementThrottledError } from './observation-refiner';
import { RecognitionObservationRefiner } from './recognition-observation-refiner';

const refinerFailingWith = (error: Error) =>
  new RecognitionObservationRefiner({ refine: jest.fn().mockRejectedValue(error) } as unknown as RecognitionService);

describe('RecognitionObservationRefiner', () => {
  it('runs the server refinement for the observation and passes whether it is the last attempt', async () => {
    const refine = jest.fn().mockResolvedValue(undefined);
    const refiner = new RecognitionObservationRefiner({ refine } as unknown as RecognitionService);

    await refiner.refine('obs-1', 'farm-1', true);

    expect(refine).toHaveBeenCalledWith('obs-1', 'farm-1', true);
  });

  it('reports a rate-limited provider as throttled', async () => {
    const failing = refinerFailingWith(new RecognitionUnavailableError({ retryAfterMs: 7000, dailyQuotaExhausted: true }));

    await expect(failing.refine('obs-1', 'farm-1', false))
      .rejects.toEqual(expect.objectContaining({ retryAfterMs: 7000, quotaExhausted: true }));
    await expect(failing.refine('obs-1', 'farm-1', false)).rejects.toBeInstanceOf(RefinementThrottledError);
  });

  it('passes other failures through unchanged', async () => {
    const error = new RecognitionUnavailableError();

    await expect(refinerFailingWith(error).refine('obs-1', 'farm-1', false)).rejects.toBe(error);
  });
});
