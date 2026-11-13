import { ClassifierTrainer } from '../classifier/classifier-trainer.service';
import { buildSimilarityConfig } from '../similarity.config';
import { RetrainScheduler } from './retrain-scheduler.service';

describe('RetrainScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const schedulerWith = (train: jest.Mock) =>
    new RetrainScheduler(buildSimilarityConfig({ SIMILARITY_RETRAIN_DELAY_MS: '1000' }), { train } as unknown as ClassifierTrainer);
  const trained = { file: { sampleCounts: { rust: 2 } } };

  it('trains once after a burst of confirmations, without measuring accuracy', async () => {
    const train = jest.fn().mockResolvedValue(trained);
    const scheduler = schedulerWith(train);
    scheduler.schedule();
    await jest.advanceTimersByTimeAsync(500);
    scheduler.schedule();
    await jest.advanceTimersByTimeAsync(999);
    expect(train).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(train).toHaveBeenCalledTimes(1);
    expect(train).toHaveBeenCalledWith(false);
  });

  it('runs once more when photos arrive during a training', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const train = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValue(trained);
    const scheduler = schedulerWith(train);
    scheduler.schedule();
    await jest.advanceTimersByTimeAsync(1000);
    scheduler.schedule();
    await jest.advanceTimersByTimeAsync(1000);
    expect(train).toHaveBeenCalledTimes(1);

    finish(trained);
    await jest.advanceTimersByTimeAsync(1000);
    expect(train).toHaveBeenCalledTimes(2);
  });

  it('survives a failed training', async () => {
    const train = jest.fn().mockRejectedValue(new Error('qdrant down'));
    schedulerWith(train).schedule();

    await expect(jest.advanceTimersByTimeAsync(1000)).resolves.toBeUndefined();
    expect(train).toHaveBeenCalledTimes(1);
  });
});
