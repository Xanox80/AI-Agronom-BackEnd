import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActiveSubstanceEntity, CatalogDiagnosisEntity, CatalogStateEntity, CropEntity, ProductActiveSubstanceEntity,
  ProductEntity, ProductRegistrationEntity, ThresholdEntity,
} from '../../domain/entities';

export interface SubstanceView {
  code: string; nameUk: string; concentration: string; resistanceSystem: string; resistanceGroup: string;
  maxApplicationsPerSeason: number | null;
}
export interface ProductView { product: ProductEntity; substances: SubstanceView[] }

/** Read-only access to catalogue rows (be-catalog owns the writes and the approval process). */
@Injectable()
export class CatalogReader {
  constructor(
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(ThresholdEntity) private readonly thresholds: Repository<ThresholdEntity>,
    @InjectRepository(ProductRegistrationEntity) private readonly registrations: Repository<ProductRegistrationEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductActiveSubstanceEntity) private readonly productSubstances: Repository<ProductActiveSubstanceEntity>,
    @InjectRepository(ActiveSubstanceEntity) private readonly substances: Repository<ActiveSubstanceEntity>,
    @InjectRepository(CatalogStateEntity) private readonly states: Repository<CatalogStateEntity>,
  ) {}

  findCrop(id: string): Promise<CropEntity | null> { return this.crops.findOne({ where: { id } }); }

  findDiagnosis(id: string): Promise<CatalogDiagnosisEntity | null> { return this.diagnoses.findOne({ where: { id } }); }

  findThresholds(diagnosisId: string, cropId: string): Promise<ThresholdEntity[]> {
    return this.thresholds.find({ where: { diagnosisId, cropId } });
  }

  findRegistrations(cropId: string, diagnosisId: string): Promise<ProductRegistrationEntity[]> {
    return this.registrations.find({ where: { cropId, diagnosisId } });
  }

  findState(regionCode: string): Promise<CatalogStateEntity | null> { return this.states.findOne({ where: { regionCode } }); }

  async oldestProductVerification(): Promise<string | null> {
    const raw = await this.products.createQueryBuilder('p').select('MIN(p.verifiedAt)', 'oldest').getRawOne<{ oldest: string | null }>();
    return raw?.oldest ?? null;
  }

  async loadProducts(productIds: string[]): Promise<Map<string, ProductView>> {
    if (productIds.length === 0) return new Map();
    const [products, links] = await Promise.all([
      this.products.find({ where: { id: In(productIds) } }),
      this.productSubstances.find({ where: { productId: In(productIds) } }),
    ]);
    const substanceIds = [...new Set(links.map((link) => link.activeSubstanceId))];
    const substances = substanceIds.length ? await this.substances.find({ where: { id: In(substanceIds) } }) : [];
    const substanceById = new Map(substances.map((s) => [s.id, s]));
    return new Map(products.map((product) => [product.id, {
      product,
      substances: links.filter((l) => l.productId === product.id).flatMap((link) => {
        const s = substanceById.get(link.activeSubstanceId);
        return s ? [{
          code: s.code, nameUk: s.nameUk, concentration: link.concentration, resistanceSystem: s.resistanceSystem,
          resistanceGroup: s.resistanceGroup, maxApplicationsPerSeason: s.maxApplicationsPerSeason,
        }] : [];
      }),
    }]));
  }
}
