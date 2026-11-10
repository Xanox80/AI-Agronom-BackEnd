import { BadRequestException, ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Role } from '../../domain/enums';
import { DomainEvent } from '../../domain/events';
import { AuthUser } from './observation-access';
import { ObservationMediaService } from './observation-media.service';
import { ObservationMapper } from './observation.mapper';
import { UploadPhotoDto, UploadVoiceNoteDto } from './dto/upload-media.dto';

const user: AuthUser = { id: 'u1', farmId: 'f1', role: Role.Scout };
const storageConfig = { dir: 'x', maxPhotoMb: 1, maxVoiceMb: 1, allowedImageTypes: ['image/jpeg'], maxPhotosPerObservation: 3 };

const repo = (rows: unknown[] = []) => ({
  findOneBy: jest.fn(async (where: Record<string, unknown>) => rows.find((row) => Object.entries(where).every(([k, v]) => (row as never)[k] === v)) ?? null),
  findBy: jest.fn(async () => rows),
  create: jest.fn((row) => row),
  save: jest.fn(async (row) => row),
  remove: jest.fn(),
});

const file = (mimetype: string, size = 3): Express.Multer.File => ({ mimetype, size, buffer: Buffer.alloc(size) }) as Express.Multer.File;
const photoDto = (clientId: string, seq: number) => ({ clientId, seq }) as UploadPhotoDto;

describe('ObservationMediaService', () => {
  const build = (opts: { photos?: unknown[]; voices?: unknown[] } = {}) => {
    const photos = repo(opts.photos);
    const voices = repo(opts.voices);
    const observations = repo([{ id: 'o1', farmId: 'f1' }]);
    const storage = { save: jest.fn(), read: jest.fn(async () => Buffer.from('b')), remove: jest.fn() };
    const events = { emit: jest.fn() };
    const config = { get: () => storageConfig };
    const mapper = new ObservationMapper({ get: () => ({ apiPrefix: 'api/v1' }) } as never);
    const service = new ObservationMediaService(observations as never, photos as never, voices as never, storage, mapper, events as never, config as never);
    return { service, photos, voices, storage, events };
  };

  it('stores a photo, saves its metadata and announces the upload', async () => {
    const { service, storage, events, photos } = build();
    const dto = await service.uploadPhoto(user, 'o1', file('image/jpeg'), photoDto('p1', 1));
    expect(storage.save).toHaveBeenCalledWith('photos/o1/p1.jpg', expect.any(Buffer));
    expect(photos.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', seq: 1, farmId: 'f1', sizeBytes: 3 }));
    expect(events.emit).toHaveBeenCalledWith(DomainEvent.PhotoUploaded, expect.objectContaining({ photoId: 'p1' }));
    expect(dto.url).toBe('/api/v1/photos/p1/file');
  });

  it('returns the existing photo when the same clientId is replayed', async () => {
    const { service, storage } = build({ photos: [{ id: 'p1', clientId: 'p1', observationId: 'o1', farmId: 'f1', seq: 1 }] });
    await service.uploadPhoto(user, 'o1', file('image/jpeg'), photoDto('p1', 1));
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects a fourth photo', async () => {
    const taken = [1, 2, 3].map((seq) => ({ id: `p${seq}`, clientId: `p${seq}`, seq }));
    const { service } = build({ photos: taken });
    await expect(service.uploadPhoto(user, 'o1', file('image/jpeg'), photoDto('p9', 1))).rejects.toThrow('PHOTO_LIMIT_REACHED');
  });

  it('rejects a seq that is already used', async () => {
    const { service } = build({ photos: [{ id: 'p1', clientId: 'p1', seq: 1 }] });
    await expect(service.uploadPhoto(user, 'o1', file('image/jpeg'), photoDto('p2', 1))).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects missing, oversized and wrong-type photos', async () => {
    const { service } = build();
    await expect(service.uploadPhoto(user, 'o1', undefined, photoDto('p1', 1))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadPhoto(user, 'o1', file('image/jpeg', 2 * 1024 * 1024), photoDto('p1', 1))).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.uploadPhoto(user, 'o1', file('application/pdf'), photoDto('p1', 1))).rejects.toThrow('UNSUPPORTED_IMAGE_TYPE');
  });

  it('rejects uploads to an observation of another farm', async () => {
    const { service } = build();
    await expect(service.uploadPhoto({ ...user, farmId: 'other' }, 'o1', file('image/jpeg'), photoDto('p1', 1))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores one audio voice note and refuses a second with another clientId', async () => {
    const dto = { clientId: 'v1', durationSec: 4 } as UploadVoiceNoteDto;
    const first = build();
    const result = await first.service.uploadVoiceNote(user, 'o1', file('audio/webm;codecs=opus'), dto);
    expect(first.storage.save).toHaveBeenCalledWith('voice/o1/v1.webm', expect.any(Buffer));
    expect(result.durationSec).toBe(4);

    const second = build({ voices: [{ id: 'v0', clientId: 'v0', observationId: 'o1' }] });
    await expect(second.service.uploadVoiceNote(user, 'o1', file('audio/webm'), dto)).rejects.toThrow('VOICE_NOTE_EXISTS');
    await expect(build().service.uploadVoiceNote(user, 'o1', file('image/jpeg'), dto)).rejects.toThrow('UNSUPPORTED_AUDIO_TYPE');
  });

  it('serves a photo only inside the caller farm', async () => {
    const { service } = build({ photos: [{ id: 'p1', farmId: 'f1', storageKey: 'k', mimeType: 'image/jpeg' }] });
    expect((await service.readPhoto(user, 'p1')).mimeType).toBe('image/jpeg');
    await expect(service.readPhoto({ ...user, farmId: 'other' }, 'p1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes files and rows of an observation', async () => {
    const { service, storage, photos } = build({ photos: [{ id: 'p1', storageKey: 'k1' }] });
    await service.removeAll('o1');
    expect(storage.remove).toHaveBeenCalledWith('k1');
    expect(photos.remove).toHaveBeenCalled();
  });

  it('rejects a replayed voice or photo clientId that belongs to another observation or farm', async () => {
    const { service } = build({
      voices: [{ clientId: 'v1', observationId: 'o2', farmId: 'f2' }],
      photos: [{ clientId: 'p1', observationId: 'o2', farmId: 'f2' }],
    });
    await expect(service.uploadVoiceNote(user, 'o1', file('audio/webm'), { clientId: 'v1', durationSec: 1 } as UploadVoiceNoteDto)).rejects.toThrow(ConflictException);
    await expect(service.uploadPhoto(user, 'o1', file('image/jpeg'), photoDto('p1', 1))).rejects.toThrow(ConflictException);
  });
});
