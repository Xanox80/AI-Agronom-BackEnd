import { readFile } from 'fs/promises';
import { join } from 'path';
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { FieldEntity, ObservationEntity, PhotoEntity } from '../../domain/entities';
import { VisionContext, VisionPhoto } from '../vision-provider/vision.types';
import { CatalogReader } from './catalog-reader.service';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';

export interface ObservationFrames {
  observation: ObservationEntity;
  photoSeqs: number[];
  photos: VisionPhoto[];
  context: VisionContext;
}

/** Gathers what the provider needs for an observation: photo bytes plus crop, weather and field history context. */
@Injectable()
export class ObservationContextLoader {
  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photoRows: Repository<PhotoEntity>,
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    private readonly catalog: CatalogReader,
    @Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig,
  ) {}

  async load(observationId: string, farmId: string): Promise<ObservationFrames> {
    const observation = await this.observations.findOne({ where: { id: observationId, farmId } });
    if (!observation) throw new NotFoundException('Observation not found');
    const rows = await this.photoRows.find({ where: { observationId }, order: { seq: 'ASC' }, take: this.config.maxPhotos });
    if (!rows.length) throw new BadRequestException('Observation has no photos');
    const photos = await Promise.all(rows.map(async (row) => ({
      bytes: await readFile(join(this.config.storageDir, row.storageKey)), mimeType: row.mimeType,
    })));
    return { observation, photoSeqs: rows.map((row) => row.seq), photos, context: await this.contextOf(observation) };
  }

  private async contextOf(observation: ObservationEntity): Promise<VisionContext> {
    const field = observation.fieldId ? await this.fields.findOne({ where: { id: observation.fieldId } }) : null;
    return {
      cropCode: await this.catalog.cropCodeById(observation.cropId),
      bbch: observation.bbchStage ?? undefined,
      temperatureC: observation.temperatureC ?? undefined,
      humidityPct: observation.humidityPct ?? undefined,
      variety: field?.variety ?? undefined,
      organHint: observation.organ ?? undefined,
      fieldHistory: await this.fieldHistory(observation),
    };
  }

  private async fieldHistory(observation: ObservationEntity): Promise<string[] | undefined> {
    if (!observation.fieldId) return undefined;
    const past = await this.observations.find({
      where: { fieldId: observation.fieldId, confirmedDiagnosisId: Not(IsNull()) },
      order: { capturedAt: 'DESC' }, take: this.config.fieldHistoryLimit,
    });
    const catalog = await this.catalog.diagnosesByCode();
    const codeById = new Map([...catalog.values()].map((d) => [d.id, d.code]));
    const codes = past.flatMap((o) => codeById.get(o.confirmedDiagnosisId ?? '') ?? []);
    return codes.length ? codes : undefined;
  }
}
