import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogDiagnosisEntity, CropEntity, ObservationEntity, PhotoEntity } from '../../../domain/entities';
import { DomainEvent, ObservationConfirmedEvent } from '../../../domain/events';
import { PHOTO_STORAGE, PhotoStorage } from '../../observations/storage/photo-storage';
import { referencePointId } from '../indexing/reference-indexer';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity.config';
import { CONFIRMED_SOURCE, IMAGE_EMBEDDER, ImageEmbedder, REFERENCE_INDEX, ReferenceIndex, ReferencePoint } from '../similarity.types';
import { RetrainScheduler } from './retrain-scheduler.service';

const CONFIRMED_ATTRIBUTION = 'AP Scout';

/**
 * Feedback loop: when a user confirms or corrects a diagnosis, the observation's photos join the reference
 * base under the confirmed label and the classifier is retrained shortly after. Re-confirming the same
 * observation with another diagnosis overwrites its photos' labels (point ids derive from the photo id).
 */
@Injectable()
export class ConfirmedPhotoLearner {
  private readonly logger = new Logger(ConfirmedPhotoLearner.name);

  constructor(
    @Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig,
    @Inject(IMAGE_EMBEDDER) private readonly embedder: ImageEmbedder,
    @Inject(REFERENCE_INDEX) private readonly index: ReferenceIndex,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    private readonly retrain: RetrainScheduler,
  ) {}

  @OnEvent(DomainEvent.ObservationConfirmed, { async: true })
  async onObservationConfirmed(event: ObservationConfirmedEvent): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const added = await this.addPhotos(event);
      if (added) {
        this.logger.log(`Added ${added} confirmed photo(s) of observation ${event.observationId} to the reference base`);
        this.retrain.schedule();
      }
    } catch (error) {
      this.logger.warn(`Confirmed photos of observation ${event.observationId} not added: ${(error as Error).name}`);
    }
  }

  private async addPhotos(event: ObservationConfirmedEvent): Promise<number> {
    const [observation, diagnosis, photos] = await Promise.all([
      this.observations.findOneBy({ id: event.observationId }),
      this.diagnoses.findOne({ where: { id: event.diagnosisId }, relations: { crops: true } }),
      this.photos.find({ where: { observationId: event.observationId }, order: { seq: 'ASC' } }),
    ]);
    if (!observation || !diagnosis || !photos.length) return 0;
    const cropCode = (observation.cropId && (await this.crops.findOneBy({ id: observation.cropId }))?.code) || diagnosis.crops?.[0]?.code;
    if (!cropCode) return 0;

    const points: ReferencePoint[] = [];
    for (const photo of photos) {
      const vector = await this.embedder.embed({ bytes: await this.storage.read(photo.storageKey), mimeType: photo.mimeType });
      points.push({
        id: referencePointId(CONFIRMED_SOURCE, photo.id), vector,
        payload: {
          diagnosisCode: diagnosis.code, cropCode, source: CONFIRMED_SOURCE, imagePath: photo.storageKey,
          datasetLabel: diagnosis.code, attribution: CONFIRMED_ATTRIBUTION,
        },
      });
    }
    await this.index.prepare(points[0].vector.length);
    await this.index.upsert(points);
    return points.length;
  }
}
