import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import {
  ActiveSubstanceEntity, BbchStageEntity, CatalogDiagnosisEntity, CropEntity, ProductActiveSubstanceEntity, ProductEntity,
  ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../domain/entities';
import { REFERENCE_IMAGE_ROUTE } from './catalog.constants';
import {
  toActiveSubstanceDto, toBbchStageDto, toCropDto, toDiagnosisDto, toRegistrationDto, toThresholdDto,
} from './catalog.mapper';
import type {
  ActiveSubstanceDto, BbchStageDto, CatalogDiagnosisDto, CropDto, ProductDto, ProductRegistrationDto, ReferenceImageDto,
  ThresholdDto,
} from './dto/catalog.dto';
import type { DiagnosisQueryDto, ProductQueryDto, ThresholdQueryDto } from './dto/catalog-query.dto';

/** Read side of the reference directories; also the entry point other modules use (architecture section 5). */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    @InjectRepository(BbchStageEntity) private readonly bbch: Repository<BbchStageEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(ThresholdEntity) private readonly thresholds: Repository<ThresholdEntity>,
    @InjectRepository(ActiveSubstanceEntity) private readonly substances: Repository<ActiveSubstanceEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductActiveSubstanceEntity) private readonly productSubstances: Repository<ProductActiveSubstanceEntity>,
    @InjectRepository(ProductRegistrationEntity) private readonly registrations: Repository<ProductRegistrationEntity>,
    @InjectRepository(ReferenceImageEntity) private readonly images: Repository<ReferenceImageEntity>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async listCrops(): Promise<CropDto[]> {
    return (await this.crops.find({ order: { code: 'ASC' } })).map(toCropDto);
  }

  async listBbchStages(cropId: string): Promise<BbchStageDto[]> {
    return (await this.bbch.find({ where: { cropId }, order: { bbchFrom: 'ASC' } })).map(toBbchStageDto);
  }

  async listDiagnoses(query: DiagnosisQueryDto = {}): Promise<CatalogDiagnosisDto[]> {
    const text = query.q ? `%${query.q}%` : undefined;
    const where: FindOptionsWhere<CatalogDiagnosisEntity> = query.category ? { problemCategory: query.category } : {};
    const rows = await this.diagnoses.find({
      where: text ? [{ ...where, nameUk: Like(text) }, { ...where, nameEn: Like(text) }, { ...where, code: Like(text) }] : where,
      relations: { crops: true }, order: { code: 'ASC' },
    });
    // shortcut: crop filter runs in memory because the directory is tens of rows; push into SQL if it grows
    return rows.filter((d) => !query.cropId || d.crops.some((c) => c.id === query.cropId)).map(toDiagnosisDto);
  }

  async getDiagnosisByCode(code: string): Promise<CatalogDiagnosisDto | null> {
    const row = await this.diagnoses.findOne({ where: { code }, relations: { crops: true } });
    return row ? toDiagnosisDto(row) : null;
  }

  async getReferenceImages(diagnosisId: string): Promise<ReferenceImageDto[]> {
    const diagnosis = await this.diagnoses.findOne({ where: { id: diagnosisId } });
    if (!diagnosis) throw new NotFoundException({ code: 'DIAGNOSIS_NOT_FOUND', message: 'Diagnosis not found' });
    return this.toReferenceImageDtos(await this.images.find({ where: { diagnosisId } }));
  }

  async toReferenceImageDtos(rows: ReferenceImageEntity[]): Promise<ReferenceImageDto[]> {
    const codes = await this.diagnosisCodes(rows.map((r) => r.diagnosisId));
    const prefix = this.config.get('app', { infer: true }).apiPrefix;
    return rows.map((r) => ({
      id: r.id, diagnosisCode: codes.get(r.diagnosisId) ?? '', stage: r.stage ?? undefined,
      url: `/${prefix}/${REFERENCE_IMAGE_ROUTE}/${r.id}/file`, caption: r.caption, attribution: r.attribution,
    }));
  }

  async getThresholds(query: ThresholdQueryDto & { bbch?: number } = {}): Promise<ThresholdDto[]> {
    const where: FindOptionsWhere<ThresholdEntity> = {};
    if (query.diagnosisId) where.diagnosisId = query.diagnosisId;
    if (query.cropId) where.cropId = query.cropId;
    if (query.bbch !== undefined) Object.assign(where, { bbchFrom: LessThanOrEqual(query.bbch), bbchTo: MoreThanOrEqual(query.bbch) });
    return (await this.thresholds.find({ where, order: { bbchFrom: 'ASC' } })).map(toThresholdDto);
  }

  async listActiveSubstances(): Promise<ActiveSubstanceDto[]> {
    return (await this.substances.find({ order: { code: 'ASC' } })).map(toActiveSubstanceDto);
  }

  async listProducts(query: ProductQueryDto = {}): Promise<ProductDto[]> {
    const qb = this.products.createQueryBuilder('p').distinct(true).orderBy('p.name', 'ASC');
    if (query.q) qb.andWhere('p.name LIKE :q', { q: `%${query.q}%` });
    if (query.cropId || query.diagnosisId) {
      qb.innerJoin(ProductRegistrationEntity, 'r', 'r.productId = p.id');
      if (query.cropId) qb.andWhere('r.cropId = :cropId', { cropId: query.cropId });
      if (query.diagnosisId) qb.andWhere('r.diagnosisId = :diagnosisId', { diagnosisId: query.diagnosisId });
    }
    if (query.activeSubstance) {
      qb.innerJoin(ProductActiveSubstanceEntity, 'pas', 'pas.productId = p.id')
        .innerJoin(ActiveSubstanceEntity, 's', 's.id = pas.activeSubstanceId')
        .andWhere('s.code = :substance', { substance: query.activeSubstance });
    }
    return this.toProductDtos(await qb.getMany());
  }

  async toProductDtos(rows: ProductEntity[]): Promise<ProductDto[]> {
    const links = rows.length ? await this.productSubstances.find({ where: { productId: In(rows.map((p) => p.id)) } }) : [];
    const substances = new Map((await this.substances.find()).map((s) => [s.id, s]));
    return rows.map((p) => ({
      id: p.id, name: p.name, registrationNumber: p.registrationNumber, pollinatorHazard: p.pollinatorHazard,
      zones: { water: p.waterProtectionZoneM, apiary: p.apiaryZoneM, settlement: p.settlementZoneM },
      pricePerHaUah: p.pricePerHaUah, isDemo: p.isDemo, source: p.source, verifiedAt: p.verifiedAt,
      activeSubstances: links.filter((l) => l.productId === p.id).flatMap((l) => {
        const s = substances.get(l.activeSubstanceId);
        return s ? [{ code: s.code, nameUk: s.nameUk, concentration: l.concentration, resistanceSystem: s.resistanceSystem, resistanceGroup: s.resistanceGroup }] : [];
      }),
    }));
  }

  async getProductRegistrations(productId: string): Promise<ProductRegistrationDto[]> {
    return (await this.registrations.find({ where: { productId } })).map(toRegistrationDto);
  }

  async getAllowedRegistrations(cropId: string, diagnosisId: string, bbch?: number): Promise<ProductRegistrationDto[]> {
    const where: FindOptionsWhere<ProductRegistrationEntity> = { cropId, diagnosisId };
    if (bbch !== undefined) Object.assign(where, { bbchFrom: LessThanOrEqual(bbch), bbchTo: MoreThanOrEqual(bbch) });
    return (await this.registrations.find({ where, order: { efficacyScore: 'DESC' } })).map(toRegistrationDto);
  }

  private async diagnosisCodes(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.diagnoses.find({ where: { id: In(ids) }, select: { id: true, code: true } });
    return new Map(rows.map((d) => [d.id, d.code]));
  }
}
