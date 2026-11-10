import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { ObservationEntity, PhotoEntity, VoiceNoteEntity } from '../../domain/entities';
import type { ObservationDto, PhotoDto, VoiceNoteDto } from '../../domain/types';

@Injectable()
export class ObservationMapper {
  private readonly apiPrefix: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.apiPrefix = config.get('app', { infer: true }).apiPrefix;
  }

  toDto(observation: ObservationEntity, photos: PhotoEntity[], voiceNote?: VoiceNoteEntity | null): ObservationDto {
    return {
      id: observation.id,
      clientId: observation.clientId,
      fieldId: observation.fieldId ?? undefined,
      fieldLinkMethod: observation.fieldLinkMethod,
      cropId: observation.cropId ?? undefined,
      bbchStage: observation.bbchStage ?? undefined,
      lat: observation.lat ?? undefined,
      lng: observation.lng ?? undefined,
      gpsAccuracyM: observation.gpsAccuracyM ?? undefined,
      capturedAt: observation.capturedAt.toISOString(),
      deviceModel: observation.deviceModel ?? undefined,
      temperatureC: observation.temperatureC ?? undefined,
      humidityPct: observation.humidityPct ?? undefined,
      organ: observation.organ ?? undefined,
      textNote: observation.textNote ?? undefined,
      scaleMarkerUsed: observation.scaleMarkerUsed,
      isQuickCapture: observation.isQuickCapture,
      status: observation.status,
      photos: [...photos].sort((a, b) => a.seq - b.seq).map((photo) => this.photoDto(photo)),
      voiceNote: voiceNote ? this.voiceNoteDto(voiceNote) : undefined,
      confirmedDiagnosisId: observation.confirmedDiagnosisId ?? undefined,
    };
  }

  photoDto(photo: PhotoEntity): PhotoDto {
    return {
      id: photo.id, clientId: photo.clientId, seq: photo.seq, widthPx: photo.widthPx, heightPx: photo.heightPx,
      qualityReport: photo.qualityReport, url: `/${this.apiPrefix}/photos/${photo.id}/file`,
    };
  }

  voiceNoteDto(voiceNote: VoiceNoteEntity): VoiceNoteDto {
    return {
      id: voiceNote.id, clientId: voiceNote.clientId, durationSec: voiceNote.durationSec,
      transcript: voiceNote.transcript ?? undefined, url: `/${this.apiPrefix}/voice-notes/${voiceNote.id}/file`,
    };
  }
}
