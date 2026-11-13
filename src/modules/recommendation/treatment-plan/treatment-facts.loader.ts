import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FieldEntity, ObservationEntity, ProductRegistrationEntity, RecommendationEntity, RecommendationItemEntity } from '../../../domain/entities';
import { CatalogReader, ProductView } from '../catalog.reader';
import { TREATMENT_PLAN_SETTINGS, TreatmentPlanSettings } from './treatment-plan.settings';
import { PlanProduct, TreatmentFacts } from './treatment-plan.types';

function planProduct(item: RecommendationItemEntity, registration: ProductRegistrationEntity, view: ProductView | undefined): PlanProduct {
  return {
    productId: item.productId,
    name: view?.product.name ?? item.productId,
    activeSubstances: view ? view.substances.map((s) => `${s.nameUk} ${s.concentration}`).join(', ') : item.activeSubstanceCodes.join(', '),
    rateMin: registration.rateMin, rateMax: registration.rateMax, rateUnit: registration.rateUnit,
    maxApplications: registration.maxApplications, minIntervalDays: registration.minIntervalDays,
    preHarvestIntervalDays: registration.preHarvestIntervalDays, bbchFrom: registration.bbchFrom, bbchTo: registration.bbchTo,
    resistanceGroup: item.resistanceGroup, inStock: item.inStock,
  };
}

/** Collects what the plan may build on: the products the rules engine kept, with their registry limits. */
@Injectable()
export class TreatmentFactsLoader {
  constructor(
    @InjectRepository(RecommendationEntity) private readonly recommendations: Repository<RecommendationEntity>,
    @InjectRepository(RecommendationItemEntity) private readonly items: Repository<RecommendationItemEntity>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    @InjectRepository(ProductRegistrationEntity) private readonly registrations: Repository<ProductRegistrationEntity>,
    private readonly catalog: CatalogReader,
    @Inject(TREATMENT_PLAN_SETTINGS) private readonly settings: TreatmentPlanSettings,
  ) {}

  async load(farmId: string, recommendationId: string): Promise<TreatmentFacts> {
    const recommendation = await this.recommendations.findOne({ where: { id: recommendationId, farmId } });
    if (!recommendation) throw new NotFoundException('RECOMMENDATION_NOT_FOUND');
    const observation = await this.observations.findOne({ where: { id: recommendation.observationId, farmId } });
    const field = observation?.fieldId ? await this.fields.findOne({ where: { id: observation.fieldId, farmId } }) : null;
    const cropId = observation?.cropId ?? field?.cropId ?? null;
    const [crop, diagnosis, items] = await Promise.all([
      cropId ? this.catalog.findCrop(cropId) : null,
      recommendation.confirmedDiagnosisId ? this.catalog.findDiagnosis(recommendation.confirmedDiagnosisId) : null,
      this.items.find({ where: { recommendationId, excluded: false }, order: { rank: 'ASC' } }),
    ]);
    return {
      cropNameUk: crop?.nameUk ?? '',
      diagnosisNameUk: diagnosis?.nameUk ?? '',
      bbch: observation?.bbchStage ?? null,
      areaHa: field?.areaHa ?? null,
      actionLevel: recommendation.actionLevel,
      weatherVerdict: recommendation.weatherVerdict,
      warningCodes: recommendation.safetyWarnings.map((w) => w.code),
      products: await this.products(items),
      waterLPerHa: this.settings.waterLPerHa,
    };
  }

  private async products(items: RecommendationItemEntity[]): Promise<PlanProduct[]> {
    if (!items.length) return [];
    const ids = items.map((item) => item.productRegistrationId);
    const [registrations, views] = await Promise.all([
      this.registrations.find({ where: { id: In(ids) } }),
      this.catalog.loadProducts(items.map((item) => item.productId)),
    ]);
    const byId = new Map(registrations.map((r) => [r.id, r]));
    return items.flatMap((item) => {
      const registration = byId.get(item.productRegistrationId);
      return registration ? [planProduct(item, registration, views.get(item.productId))] : [];
    });
  }
}
