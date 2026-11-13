import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisResultEntity, PhotoEntity } from '../../domain/entities';
import { DiagnosisResultDto, HypothesisDto, ReferenceImageDto } from '../../domain/types';
import { CatalogReader } from './catalog-reader.service';
import { DiagnosisStore } from './diagnosis-store.service';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';
import { RecognitionStatus } from './recognition.constants';
import { similarPhotoReferences } from './similar-photo-references';

export interface RecognitionResultDto extends DiagnosisResultDto {
  status: RecognitionStatus;
}

@Injectable()
export class DiagnosisPresenter {
  constructor(
    private readonly store: DiagnosisStore,
    private readonly catalog: CatalogReader,
    @Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
  ) {}

  async present(result: DiagnosisResultEntity): Promise<RecognitionResultDto> {
    const [hypotheses, catalog] = await Promise.all([this.store.hypothesesOf(result.id), this.catalog.diagnosesByCode()]);
    const imagesByDiagnosis = await this.catalog.referenceImages(
      hypotheses.flatMap((h) => (h.diagnosisId ? [h.diagnosisId] : [])), result.cropCode, this.config.referencesPerHypothesis);

    const hypothesisDtos: HypothesisDto[] = hypotheses.map((h) => ({
      rank: h.rank,
      diagnosisId: h.diagnosisId ?? undefined,
      diagnosisCode: h.diagnosisCode,
      nameUk: catalog.get(h.diagnosisCode)?.nameUk ?? h.diagnosisCode,
      nameEn: catalog.get(h.diagnosisCode)?.nameEn ?? h.diagnosisCode,
      probability: h.probability,
      stage: h.stage ?? undefined,
      evidence: h.evidence,
      region: h.regionX === null || h.regionPhotoSeq === null
        ? undefined
        : { x: h.regionX, y: h.regionY ?? 0, w: h.regionW ?? 0, h: h.regionH ?? 0, photoSeq: h.regionPhotoSeq },
    }));
    const similar = similarPhotoReferences(result.rawResponse, hypotheses.map((h) => h.diagnosisCode), this.config.similarPhotoUrlBase);
    const referenceImages: ReferenceImageDto[] = hypotheses.flatMap((h) => [
      ...similar.filter((image) => image.diagnosisCode === h.diagnosisCode),
      ...(imagesByDiagnosis.get(h.diagnosisId ?? '') ?? []).map((image) => ({
        id: image.id, diagnosisCode: h.diagnosisCode, stage: image.stage ?? undefined,
        url: `${this.config.referenceImageUrlBase}/${image.id}/file`,
        caption: image.caption, attribution: image.attribution,
      })),
    ].slice(0, this.config.referencesPerHypothesis));

    return {
      id: result.id, observationId: result.observationId, pass: result.pass, modelVersion: result.modelVersion,
      cropCode: result.cropCode ?? undefined, organ: result.organ ?? undefined,
      problemCategory: result.problemCategory ?? undefined, unsure: result.unsure,
      unsureReason: result.unsureReason ?? undefined, outOfDistribution: result.outOfDistribution,
      hypotheses: hypothesisDtos,
      pest: result.pestSpecies || result.pestDensityPerPlant !== null || result.pestDensityPerM2 !== null
        ? {
          species: result.pestSpecies ?? undefined, stage: result.pestStage ?? undefined,
          densityPerPlant: result.pestDensityPerPlant ?? undefined, densityPerM2: result.pestDensityPerM2 ?? undefined,
        }
        : undefined,
      clarifyingQuestions: result.clarifyingQuestions, answers: result.answers, referenceImages,
      needsMorePhotos: result.unsure && (await this.photos.count({ where: { observationId: result.observationId } })) < this.config.maxPhotos,
      createdAt: result.createdAt.toISOString(),
      status: result.unsure ? RecognitionStatus.NeedsExpert : RecognitionStatus.Ok,
    };
  }
}
