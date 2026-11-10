import { ObservationEntity, PhotoEntity, VoiceNoteEntity } from '../../domain/entities';
import { FieldLinkMethod, ObservationStatus } from '../../domain/enums';
import { ObservationMapper } from './observation.mapper';

describe('ObservationMapper', () => {
  const mapper = new ObservationMapper({ get: () => ({ apiPrefix: 'api/v1' }) } as never);
  const observation = {
    id: 'o1', clientId: 'o1', fieldId: null, fieldLinkMethod: FieldLinkMethod.None, cropId: null, bbchStage: 31,
    lat: null, lng: null, gpsAccuracyM: null, capturedAt: new Date('2026-05-01T10:00:00Z'), deviceModel: null,
    temperatureC: 12, humidityPct: null, organ: null, textNote: null, scaleMarkerUsed: false, isQuickCapture: true,
    status: ObservationStatus.Synced, confirmedDiagnosisId: null,
  } as ObservationEntity;

  it('drops null columns and formats the capture time as ISO', () => {
    const dto = mapper.toDto(observation, []);
    expect(dto.capturedAt).toBe('2026-05-01T10:00:00.000Z');
    expect(dto.fieldId).toBeUndefined();
    expect(dto.temperatureC).toBe(12);
  });

  it('orders photos by seq and builds file urls from the api prefix', () => {
    const photos = [{ id: 'p2', seq: 2 }, { id: 'p1', seq: 1 }] as PhotoEntity[];
    const dto = mapper.toDto(observation, photos);
    expect(dto.photos.map((photo) => photo.id)).toEqual(['p1', 'p2']);
    expect(dto.photos[0].url).toBe('/api/v1/photos/p1/file');
  });

  it('includes the voice note when present', () => {
    const voice = { id: 'v1', clientId: 'v1', durationSec: 4, transcript: null } as VoiceNoteEntity;
    expect(mapper.toDto(observation, [], voice).voiceNote?.url).toBe('/api/v1/voice-notes/v1/file');
  });
});
