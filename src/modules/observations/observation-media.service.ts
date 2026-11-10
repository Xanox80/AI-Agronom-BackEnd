import { createHash } from 'crypto';
import {
  BadRequestException, ConflictException, Inject, Injectable, NotFoundException, PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { ObservationEntity, PhotoEntity, VoiceNoteEntity } from '../../domain/entities';
import { DomainEvent, PhotoUploadedEvent } from '../../domain/events';
import type { PhotoDto, VoiceNoteDto } from '../../domain/types';
import { farmScope } from '../expert/farm-scope';
import { UploadPhotoDto, UploadVoiceNoteDto } from './dto/upload-media.dto';
import { AuthUser } from './observation-access';
import {
  AUDIO_MIME_PREFIX, BYTES_PER_MB, DEFAULT_AUDIO_EXTENSION, MIME_EXTENSIONS, PHOTO_STORAGE_DIR, VOICE_STORAGE_DIR,
} from './observation.constants';
import { ObservationMapper } from './observation.mapper';
import { PHOTO_STORAGE, PhotoStorage } from './storage/photo-storage';

export interface StoredFile { bytes: Buffer; mimeType: string }

/** Photos (1-3 angles, FR-3) and the optional voice note of an observation. */
@Injectable()
export class ObservationMediaService {
  private readonly limits: AppConfig['storage'];

  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(VoiceNoteEntity) private readonly voiceNotes: Repository<VoiceNoteEntity>,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    private readonly mapper: ObservationMapper,
    private readonly events: EventEmitter2,
    config: ConfigService<AppConfig, true>,
  ) {
    this.limits = config.get('storage', { infer: true });
  }

  async uploadPhoto(user: AuthUser, observationId: string, file: Express.Multer.File | undefined, dto: UploadPhotoDto): Promise<PhotoDto> {
    const observation = await this.requireObservation(user, observationId);
    const bytes = this.requireFile(file, this.limits.maxPhotoMb);
    if (!this.limits.allowedImageTypes.includes(file!.mimetype)) throw new BadRequestException('UNSUPPORTED_IMAGE_TYPE');

    const existing = await this.photos.findOneBy({ clientId: dto.clientId });
    if (existing) {
      this.requireSameOwner(existing, user, observationId);
      return this.mapper.photoDto(existing);
    }

    const taken = await this.photos.findBy({ observationId });
    if (taken.length >= this.limits.maxPhotosPerObservation || dto.seq > this.limits.maxPhotosPerObservation) {
      throw new BadRequestException('PHOTO_LIMIT_REACHED');
    }
    if (taken.some((photo) => photo.seq === dto.seq)) throw new ConflictException('PHOTO_SEQ_TAKEN');

    const storageKey = `${PHOTO_STORAGE_DIR}/${observationId}/${dto.clientId}${MIME_EXTENSIONS[file!.mimetype] ?? ''}`;
    await this.storage.save(storageKey, bytes);
    // shortcut: pixel size is client-supplied, no image decoder; add one if server-side resizing arrives
    const saved = await this.photos.save(this.photos.create({
      id: dto.clientId, clientId: dto.clientId, observationId, farmId: observation.farmId, seq: dto.seq, storageKey,
      mimeType: file!.mimetype, widthPx: dto.widthPx ?? 0, heightPx: dto.heightPx ?? 0, sizeBytes: bytes.length,
      qualityReport: dto.qualityReport ?? null, sha256: createHash('sha256').update(bytes).digest('hex'),
    }));
    const event: PhotoUploadedEvent = { photoId: saved.id, observationId, farmId: saved.farmId };
    this.events.emit(DomainEvent.PhotoUploaded, event);
    return this.mapper.photoDto(saved);
  }

  async uploadVoiceNote(user: AuthUser, observationId: string, file: Express.Multer.File | undefined, dto: UploadVoiceNoteDto): Promise<VoiceNoteDto> {
    const observation = await this.requireObservation(user, observationId);
    const bytes = this.requireFile(file, this.limits.maxVoiceMb);
    if (!file!.mimetype.startsWith(AUDIO_MIME_PREFIX)) throw new BadRequestException('UNSUPPORTED_AUDIO_TYPE');

    const replayed = await this.voiceNotes.findOneBy({ clientId: dto.clientId });
    if (replayed) {
      this.requireSameOwner(replayed, user, observationId);
      return this.mapper.voiceNoteDto(replayed);
    }
    if (await this.voiceNotes.findOneBy({ observationId })) throw new ConflictException('VOICE_NOTE_EXISTS');

    const extension = file!.mimetype.slice(AUDIO_MIME_PREFIX.length).split(';')[0];
    const storageKey = `${VOICE_STORAGE_DIR}/${observationId}/${dto.clientId}.${extension || DEFAULT_AUDIO_EXTENSION}`;
    await this.storage.save(storageKey, bytes);
    const saved = await this.voiceNotes.save(this.voiceNotes.create({
      id: dto.clientId, clientId: dto.clientId, observationId, farmId: observation.farmId, storageKey,
      mimeType: file!.mimetype, durationSec: dto.durationSec, transcript: null,
    }));
    return this.mapper.voiceNoteDto(saved);
  }

  async findForObservations(ids: string[]): Promise<{ photos: PhotoEntity[]; voiceNotes: VoiceNoteEntity[] }> {
    if (ids.length === 0) return { photos: [], voiceNotes: [] };
    const [photos, voiceNotes] = await Promise.all([
      this.photos.findBy({ observationId: In(ids) }),
      this.voiceNotes.findBy({ observationId: In(ids) }),
    ]);
    return { photos, voiceNotes };
  }

  async readPhoto(user: AuthUser, photoId: string): Promise<StoredFile> {
    const photo = await this.photos.findOneBy({ id: photoId, farmId: farmScope({ user }) });
    if (!photo) throw new NotFoundException('PHOTO_NOT_FOUND');
    return { bytes: await this.storage.read(photo.storageKey), mimeType: photo.mimeType };
  }

  async readVoiceNote(user: AuthUser, voiceNoteId: string): Promise<StoredFile> {
    const note = await this.voiceNotes.findOneBy({ id: voiceNoteId, farmId: user.farmId });
    if (!note) throw new NotFoundException('VOICE_NOTE_NOT_FOUND');
    return { bytes: await this.storage.read(note.storageKey), mimeType: note.mimeType };
  }

  async removeAll(observationId: string): Promise<void> {
    const { photos, voiceNotes } = await this.findForObservations([observationId]);
    await Promise.all([...photos, ...voiceNotes].map((media) => this.storage.remove(media.storageKey)));
    await this.photos.remove(photos);
    await this.voiceNotes.remove(voiceNotes);
  }

  private async requireObservation(user: AuthUser, id: string): Promise<ObservationEntity> {
    const observation = await this.observations.findOneBy({ id, farmId: user.farmId });
    if (!observation) throw new NotFoundException('OBSERVATION_NOT_FOUND');
    return observation;
  }

  private requireSameOwner(media: { farmId: string; observationId: string }, user: AuthUser, observationId: string): void {
    if (media.farmId !== user.farmId || media.observationId !== observationId) throw new ConflictException('CLIENT_ID_TAKEN');
  }

  private requireFile(file: Express.Multer.File | undefined, maxMb: number): Buffer {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > maxMb * BYTES_PER_MB) throw new PayloadTooLargeException('FILE_TOO_LARGE');
    return file.buffer;
  }
}
