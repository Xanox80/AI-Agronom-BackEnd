import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import {
  CatalogDiagnosisEntity, CropEntity, ExpertCaseEntity, LabelEntity, ObservationEntity, PhotoEntity,
} from '../../domain/entities';
import { ExpertCaseStatus, LabelAction } from '../../domain/enums';
import type { AffectedRegion } from '../../domain/types';
import { EXPERT_CONFIG, ExpertConfig } from './expert.config';

export interface DatasetRecord {
  photoUrl: string;
  diagnosisCode: string;
  weight: number;
  region: AffectedRegion | null;
  cropCode: string | null;
  bbch: number | null;
  context: { temperatureC: number | null; humidityPct: number | null; organ: string | null; capturedAt: string };
}

export interface DatasetManifest {
  version: number;
  generatedAt: string;
  count: number;
  skipped: number;
  latestUpdatedAt: string | null;
}

export interface DatasetExport { manifest: DatasetManifest; records: DatasetRecord[] }

/** `labeled` counts every confirm/change label including unverified user ones; `exportableCount` only those flagged inDataset. */
export interface DatasetStats {
  labeled: number;
  byDiagnosis: { code: string; count: number }[];
  pendingReview: number;
  exportableCount: number;
}

const CONFIRMING = [LabelAction.Confirm, LabelAction.Change];
const UNKNOWN_CODE = 'unknown';
const DATASET_FORMAT_VERSION = 1;
export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
    @InjectRepository(ExpertCaseEntity) private readonly cases: Repository<ExpertCaseEntity>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    @Inject(EXPERT_CONFIG) private readonly config: ExpertConfig,
  ) {}

  async stats(): Promise<DatasetStats> {
    const labeled = await this.labels.find({ where: { action: In(CONFIRMING) } });
    const codes = await this.codeById(this.diagnoses, labeled.map((l) => l.diagnosisId));
    const counts = new Map<string, number>();
    for (const { diagnosisId } of labeled) {
      const code = codes.get(diagnosisId ?? '') ?? UNKNOWN_CODE;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return {
      labeled: labeled.length,
      byDiagnosis: [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
      pendingReview: await this.cases.count({ where: { status: In([ExpertCaseStatus.Open, ExpertCaseStatus.InReview]) } }),
      exportableCount: labeled.filter((l) => l.inDataset).length,
    };
  }

  /** All confirmed labels after `since`, read page by page; the manifest lets a consumer verify completeness and resume. */
  async export(since?: Date): Promise<DatasetExport> {
    const labels = await this.exportableLabels(since);
    const records = await this.toRecords(labels);
    return {
      manifest: {
        version: DATASET_FORMAT_VERSION, generatedAt: new Date().toISOString(), count: records.length,
        skipped: labels.length - records.length, latestUpdatedAt: labels.at(-1)?.updatedAt.toISOString() ?? null,
      },
      records,
    };
  }

  private async exportableLabels(since?: Date): Promise<LabelEntity[]> {
    const where = { inDataset: true, action: In(CONFIRMING), ...(since && { updatedAt: MoreThan(since) }) };
    const all: LabelEntity[] = [];
    for (;;) {
      const page = await this.labels.find({
        where, order: { updatedAt: 'ASC', id: 'ASC' }, skip: all.length, take: this.config.datasetPageSize,
      });
      all.push(...page);
      if (page.length < this.config.datasetPageSize) return all;
    }
  }

  private async toRecords(labels: LabelEntity[]): Promise<DatasetRecord[]> {
    const observationIds = [...new Set(labels.map((l) => l.observationId))];
    const observations = observationIds.length ? await this.observations.find({ where: { id: In(observationIds) } }) : [];
    const photos = observationIds.length
      ? await this.photos.find({ where: { observationId: In(observationIds) }, order: { seq: 'ASC' } })
      : [];
    const diagnosisCodes = await this.codeById(this.diagnoses, labels.map((l) => l.diagnosisId));
    const cropCodes = await this.codeById(this.crops, observations.map((o) => o.cropId));

    return labels.flatMap((label) => {
      const observation = observations.find((o) => o.id === label.observationId);
      const photo = this.photoOf(photos, label);
      const diagnosisCode = diagnosisCodes.get(label.diagnosisId ?? '');
      if (!observation || !photo || !diagnosisCode) return [];
      return [{
        photoUrl: `/api/v1/photos/${photo.id}/file`, diagnosisCode, weight: label.weight, region: label.affectedRegion,
        cropCode: cropCodes.get(observation.cropId ?? '') ?? null, bbch: observation.bbchStage,
        context: {
          temperatureC: observation.temperatureC, humidityPct: observation.humidityPct, organ: observation.organ,
          capturedAt: observation.capturedAt.toISOString(),
        },
      }];
    });
  }

  private photoOf(photos: PhotoEntity[], label: LabelEntity): PhotoEntity | undefined {
    const ofObservation = photos.filter((p) => p.observationId === label.observationId);
    const seq = label.affectedRegion?.photoSeq;
    return ofObservation.find((p) => p.id === label.photoId || p.seq === seq) ?? ofObservation[0];
  }

  private async codeById(repo: Repository<{ id: string; code: string }>, ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const rows = unique.length ? await repo.find({ where: { id: In(unique) } }) : [];
    return new Map(rows.map((row) => [row.id, row.code]));
  }
}
