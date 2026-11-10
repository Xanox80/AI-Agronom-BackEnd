import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogDiagnosisEntity, CropEntity, ReferenceImageEntity } from '../../domain/entities';

/** Read-only catalogue access for recognition; to be replaced by be-catalog's CatalogService once it is exported. */
@Injectable()
export class CatalogReader {
  constructor(
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(ReferenceImageEntity) private readonly images: Repository<ReferenceImageEntity>,
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
  ) {}

  async diagnosesByCode(): Promise<Map<string, CatalogDiagnosisEntity>> {
    const all = await this.diagnoses.find({ relations: { crops: true } });
    return new Map(all.map((diagnosis) => [diagnosis.code, diagnosis]));
  }

  /** Codes offered to the model: those that apply to the crop, or all when the crop is unknown. */
  allowedCodes(catalog: Map<string, CatalogDiagnosisEntity>, cropCode: string | undefined): string[] {
    return [...catalog.values()]
      .filter((d) => !cropCode || !d.crops?.length || d.crops.some((crop) => crop.code === cropCode))
      .map((d) => d.code);
  }

  findDiagnosisById(id: string): Promise<CatalogDiagnosisEntity | null> {
    return this.diagnoses.findOne({ where: { id } });
  }

  async cropCodeById(cropId: string | null): Promise<string | undefined> {
    return cropId ? (await this.crops.findOne({ where: { id: cropId } }))?.code : undefined;
  }

  /** FR-10: up to `limit` images per diagnosis, those for the crop first, then generic ones. */
  async referenceImages(diagnosisIds: string[], cropCode: string | null, limit: number): Promise<Map<string, ReferenceImageEntity[]>> {
    if (!diagnosisIds.length) return new Map();
    const cropId = cropCode ? (await this.crops.findOne({ where: { code: cropCode } }))?.id : undefined;
    const rank = (image: ReferenceImageEntity) => (image.cropId === cropId ? 0 : image.cropId === null ? 1 : 2);
    const found = await this.images.find({ where: { diagnosisId: In(diagnosisIds) } });
    return new Map(diagnosisIds.map((id) => [
      id,
      found.filter((image) => image.diagnosisId === id).sort((a, b) => rank(a) - rank(b)).slice(0, limit),
    ]));
  }
}
