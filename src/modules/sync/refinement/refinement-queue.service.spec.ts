import { Repository } from 'typeorm';
import { ObservationEntity, PhotoEntity, SyncRecordEntity } from '../../../domain/entities';
import { fakeConfig } from '../__fixtures__/test-database';
import { ObservationRefiner } from './observation-refiner';
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

    expect(refine).toHaveBeenCalledWith('o1', FARM);
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

  it('does nothing when no refiner is provided', async () => {
    const queue = build(undefined);

    await expect(queue.scheduleWhenPhotosExist('o1', FARM)).resolves.toBeUndefined();
  });

  it('restores unrefined observations from the database on start', async () => {
    const refine = jest.fn().mockResolvedValue(undefined);
    const queue = build({ refine }, { pending: [{ id: 'o9', farmId: FARM }] });

    await queue.onApplicationBootstrap();
    await tick();

    expect(refine).toHaveBeenCalledWith('o9', FARM);
  });
});
