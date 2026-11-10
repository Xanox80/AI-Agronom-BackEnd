import { Column, Entity, Index } from 'typeorm';
import { FieldLinkMethod, ObservationStatus, Organ } from '../enums';
import { OfflineEntity } from './base.entity';
import type { QualityReport } from '../types';

@Entity('observations')
export class ObservationEntity extends OfflineEntity {
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) fieldId: string | null;
  @Column({ type: 'varchar', default: FieldLinkMethod.None }) fieldLinkMethod: FieldLinkMethod;
  @Column({ type: 'varchar', length: 36, nullable: true }) cropId: string | null;
  @Column({ type: 'int', nullable: true }) bbchStage: number | null;
  @Column({ type: 'float', nullable: true }) lat: number | null;
  @Column({ type: 'float', nullable: true }) lng: number | null;
  @Column({ type: 'float', nullable: true }) gpsAccuracyM: number | null;
  @Column({ type: 'datetime' }) capturedAt: Date;
  @Column({ type: 'varchar', nullable: true }) deviceModel: string | null;
  @Column({ type: 'float', nullable: true }) temperatureC: number | null;
  @Column({ type: 'float', nullable: true }) humidityPct: number | null;
  @Column({ type: 'varchar', nullable: true }) organ: Organ | null;
  @Column({ type: 'text', nullable: true }) textNote: string | null;
  @Column({ type: 'boolean', default: false }) scaleMarkerUsed: boolean;
  @Column({ type: 'varchar', default: ObservationStatus.Draft }) status: ObservationStatus;
  @Column({ type: 'boolean', default: false }) isQuickCapture: boolean;
  @Column({ type: 'varchar', length: 36, nullable: true }) confirmedDiagnosisId: string | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) confirmedByUserId: string | null;
  @Column({ type: 'datetime', nullable: true }) confirmedAt: Date | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) correctedFromDiagnosisId: string | null;
}

@Entity('photos')
export class PhotoEntity extends OfflineEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column({ type: 'int' }) seq: number;
  @Column() storageKey: string;
  @Column() mimeType: string;
  @Column({ type: 'int' }) widthPx: number;
  @Column({ type: 'int' }) heightPx: number;
  @Column({ type: 'int' }) sizeBytes: number;
  @Column({ type: 'simple-json', nullable: true }) qualityReport: QualityReport | null;
  @Column() sha256: string;
}

@Entity('voice_notes')
export class VoiceNoteEntity extends OfflineEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) observationId: string;
  @Column() storageKey: string;
  @Column() mimeType: string;
  @Column({ type: 'float' }) durationSec: number;
  @Column({ type: 'text', nullable: true }) transcript: string | null;
}
