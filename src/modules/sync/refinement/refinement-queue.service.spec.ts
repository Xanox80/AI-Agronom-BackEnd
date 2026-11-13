import { Repository } from 'typeorm';
import { ObservationEntity, PhotoEntity, SyncRecordEntity } from '../../../domain/entities';
import { fakeConfig } from '../__fixtures__/test-database';
import { ObservationRefiner, RefinementThrottledError } from './observation-refiner';
import { RefinementQueueService } from './refinement-queue.service';

const FARM = 'farm-1';
const tick = () => new Promise((resolve) => setImmediate(resolve));

function build(refiner: ObservationRefiner | undefined, opts: { hasPhotos?: boolean; fromSync?: boolean; pending?: { id: string; farmId: string }[] } = {}) {
  const query = { where: () => ({ getMany: async () => opts.pending ?? [] }) };
  const observations = { createQueryBuilder: () => query } as unknown as Repository<ObservationEntity>;
  const photos = { existsBy: async () => opts.hasPhotos ?? true } as unknown as Repository<PhotoEntity>;
  const records = { existsBy: async () => opts.fromSync ?? true } as unknown as Repository<SyncRecordEntity>;
  return new RefinementQueueService(fakeConfig() as never, observations, photos, records, refiner);
}

describe('RefinementQueueService', () => {
  it('refines an observation once photos exist after a push', async () => {
    const refine = jest.fn().mockResolvedValue(undefined);
    const queue = build({ refine });

    await queue.scheduleWhenPhotosExist('o1', FARM);
    await tick();

    expect(refine).toHaveBeenCalledWith('o1', FARM, false);
  });

  it('skips observations that have no photos yet', async () => {
    const refine = jest.fn();
    const queue = build({ refine }, { hasPhotos: false });

    await queue.scheduleWhenPhotosExist('o1', FARM);
    await tick();

    expect(refine).not.toHaveBeenCalled();
  });

  it('refines on photo upload only for observations that came through sync', async () => {
    const refine = jest.fn().mockResolvedValue(undefined);

    await build({ refine }, { fromSync: false }).onPhotoUploaded({ photoId: 'p', observationId: 'o1', farmId: FARM });
    await tick();
    expect(refine).not.toHaveBeenCalled();

    await build({ refine }, { fromSync: true }).onPhotoUploaded({ photoId: 'p', observationId: 'o1', farmId: FARM });
    await tick();
    expect(refine).toHaveBeenCalledTimes(1);
  });

  it('runs at most the configured number of refinements at once and drains the rest', async () => {
    const releases: (() => void)[] = [];
    const refine = jest.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    const queue = build({ refine });

    queue.enqueue('o1', FARM);
    queue.enqueue('o2', FARM);
    await tick();
    expect(refine).toHaveBeenCalledTimes(1);

    releases[0]();
    await tick();
    expect(refine).toHaveBeenCalledTimes(2);
    releases[1]();
  });

  it('queues the same observation again when new photos arrive while it is being refined', async () => {
    const releases: (() => void)[] = [];
    const refine = jest.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    const queue = build({ refine });

    queue.enqueue('o1', FARM);
    await tick();
    queue.enqueue('o1', FARM);
    await tick();
    expect(refine).toHaveBeenCalledTimes(1);

    releases[0]();
    await tick();
    expect(refine).toHaveBeenCalledTimes(2);
    releases[1]();
  });

  it('keeps draining after a refinement fails', async () => {
    const refine = jest.fn().mockRejectedValueOnce(new Error('provider down')).mockResolvedValue(undefined);
    const queue = build({ refine });

    queue.enqueue('o1', FARM);
    await tick();
    queue.enqueue('o2', FARM);
    await tick();

    expect(refine).toHaveBeenCalledTimes(2);
  });

  describe('after a failed refinement', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('retries with exponential backoff, capped, and flags the last attempt', async () => {
      const refine = jest.fn().mockRejectedValue(new Error('provider down'));
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(0);
      expect(refine).toHaveBeenLastCalledWith('o1', FARM, false);

      await jest.advanceTimersByTimeAsync(999);
      expect(refine).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(refine).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1500);
      expect(refine).toHaveBeenCalledTimes(3);
      expect(refine).toHaveBeenLastCalledWith('o1', FARM, true);

      await jest.advanceTimersByTimeAsync(60000);
      expect(refine).toHaveBeenCalledTimes(3);
    });

    it('stops retrying once a refinement succeeds', async () => {
      const refine = jest.fn().mockRejectedValueOnce(new Error('provider down')).mockResolvedValue(undefined);
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(1000);
      expect(refine).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(60000);
      expect(refine).toHaveBeenCalledTimes(2);
    });

    it('pauses the whole queue for the quota pause when the daily quota is spent, without spending attempts', async () => {
      const refine = jest.fn().mockRejectedValueOnce(new RefinementThrottledError(undefined, true)).mockResolvedValue(undefined);
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(0);
      queue.enqueue('o2', FARM);
      await jest.advanceTimersByTimeAsync(9999);
      expect(refine).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(refine).toHaveBeenCalledTimes(3);
      expect(refine).toHaveBeenCalledWith('o1', FARM, false);
      expect(refine).toHaveBeenCalledWith('o2', FARM, false);
    });

    it('pauses for the delay the provider asked for, at least the retry base', async () => {
      const refine = jest.fn().mockRejectedValueOnce(new RefinementThrottledError(4000, false)).mockResolvedValue(undefined);
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(3999);
      expect(refine).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(refine).toHaveBeenCalledTimes(2);
    });

    it('drops the pause when the module shuts down', async () => {
      const refine = jest.fn().mockRejectedValue(new RefinementThrottledError(undefined, true));
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(0);
      queue.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(60000);

      expect(refine).toHaveBeenCalledTimes(1);
    });

    it('drops a scheduled retry when the module shuts down', async () => {
      const refine = jest.fn().mockRejectedValue(new Error('provider down'));
      const queue = build({ refine });

      queue.enqueue('o1', FARM);
      await jest.advanceTimersByTimeAsync(0);
      queue.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(60000);

      expect(refine).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing when no refiner is provided', async () => {
    const queue = build(undefined);

    await expect(queue.scheduleWhenPhotosExist('o1', FARM)).resolves.toBeUndefined();
  });

  it('restores unrefined observations from the database on start', async () => {
    const refine = jest.fn().mockResolvedValue(undefined);
    const queue = build({ refine }, { pending: [{ id: 'o9', farmId: FARM }] });

    await queue.onApplicationBootstrap();
    await tick();

    expect(refine).toHaveBeenCalledWith('o9', FARM, false);
  });
});
