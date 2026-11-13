import { referencePointId } from '../indexing/reference-indexer';
import { buildSimilarityConfig } from '../similarity.config';
import { CONFIRMED_SOURCE, ImageEmbedder, ReferenceIndex } from '../similarity.types';
import { ConfirmedPhotoLearner } from './confirmed-photo-learner.service';
import { RetrainScheduler } from './retrain-scheduler.service';

const event = { observationId: 'o1', farmId: 'f1', userId: 'u1', diagnosisId: 'd1', correctedFromModel: true };
const rustDiagnosis = { id: 'd1', code: 'wheat_leaf_rust', crops: [{ code: 'wheat_winter' }] };

interface Setup { enabled?: boolean; cropId?: string | null; photos?: object[]; diagnosis?: object | null }

function learnerWith(setup: Setup = {}) {
  const config = { ...buildSimilarityConfig({ QDRANT_URL: 'http://q' }), enabled: setup.enabled ?? true };
  const embedder: ImageEmbedder = { embed: jest.fn().mockResolvedValue([0.6, 0.8]) };
  const index = {
    prepare: jest.fn(), upsert: jest.fn(), removeSource: jest.fn(), labelledVectors: jest.fn(), nearest: jest.fn(), payloadOf: jest.fn(),
  } as jest.Mocked<ReferenceIndex>;
  const storage = { read: jest.fn().mockResolvedValue(Buffer.from('jpg')), save: jest.fn(), remove: jest.fn() };
  const observations = { findOneBy: jest.fn().mockResolvedValue({ id: 'o1', cropId: setup.cropId === undefined ? 'c1' : setup.cropId }) };
  const photos = { find: jest.fn().mockResolvedValue(setup.photos ?? [{ id: 'ph1', storageKey: 'photos/o1/ph1.jpg', mimeType: 'image/jpeg' }]) };
  const diagnoses = { findOne: jest.fn().mockResolvedValue(setup.diagnosis === undefined ? rustDiagnosis : setup.diagnosis) };
  const crops = { findOneBy: jest.fn().mockResolvedValue({ code: 'wheat_winter' }) };
  const retrain = { schedule: jest.fn() } as unknown as RetrainScheduler;
  const learner = new ConfirmedPhotoLearner(
    config, embedder, index, storage, observations as never, photos as never, diagnoses as never, crops as never, retrain);
  return { learner, index, retrain, embedder };
}

describe('ConfirmedPhotoLearner', () => {
  it('adds the confirmed photos under the confirmed label and schedules a retrain', async () => {
    const { learner, index, retrain } = learnerWith();
    await learner.onObservationConfirmed(event);

    expect(index.upsert).toHaveBeenCalledWith([{
      id: referencePointId(CONFIRMED_SOURCE, 'ph1'), vector: [0.6, 0.8],
      payload: {
        diagnosisCode: 'wheat_leaf_rust', cropCode: 'wheat_winter', source: CONFIRMED_SOURCE, imagePath: 'photos/o1/ph1.jpg',
        datasetLabel: 'wheat_leaf_rust', attribution: 'AP Scout',
      },
    }]);
    expect(retrain.schedule).toHaveBeenCalled();
  });

  it('falls back to the diagnosis crop when the observation has none', async () => {
    const { learner, index } = learnerWith({ cropId: null });
    await learner.onObservationConfirmed(event);

    expect(index.upsert.mock.calls[0][0][0].payload.cropCode).toBe('wheat_winter');
  });

  it('does nothing when similarity is disabled', async () => {
    const { learner, embedder, retrain } = learnerWith({ enabled: false });
    await learner.onObservationConfirmed(event);

    expect(embedder.embed).not.toHaveBeenCalled();
    expect(retrain.schedule).not.toHaveBeenCalled();
  });

  it('skips observations without photos or with an unknown diagnosis', async () => {
    for (const setup of [{ photos: [] }, { diagnosis: null }]) {
      const { learner, index, retrain } = learnerWith(setup);
      await learner.onObservationConfirmed(event);
      expect(index.upsert).not.toHaveBeenCalled();
      expect(retrain.schedule).not.toHaveBeenCalled();
    }
  });

  it('never throws into the confirmation flow when Qdrant fails', async () => {
    const { learner, index, retrain } = learnerWith();
    index.upsert.mockRejectedValue(new Error('down'));

    await expect(learner.onObservationConfirmed(event)).resolves.toBeUndefined();
    expect(retrain.schedule).not.toHaveBeenCalled();
  });
});
