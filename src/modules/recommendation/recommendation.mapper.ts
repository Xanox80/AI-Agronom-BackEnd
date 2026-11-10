import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecommendationEntity, RecommendationItemEntity, UserEntity } from '../../domain/entities';
import { ActionLevel } from '../../domain/enums';
import { CatalogReader, ProductView } from './catalog.reader';
import { ExcludedItemDto, RecommendationDto, RecommendationItemDto, RecommendationProductDto, RecommendedAction } from './dto/recommendation.dto';
import { decodeReason } from './recommendation.assembler';
import { CONSULT_EXPERT_WARNING } from './pipeline/pipeline-types';

export const DRAFT_DISCLAIMER_CODE = 'recommendation.disclaimer.requires_agronomist_approval';

const TREATING_LEVELS: ActionLevel[] = [ActionLevel.Treat, ActionLevel.Urgent];

export function recommendedAction(recommendation: RecommendationEntity): RecommendedAction {
  if (recommendation.safetyWarnings.some((w) => w.code === CONSULT_EXPERT_WARNING)) return 'consult_expert';
  return TREATING_LEVELS.includes(recommendation.actionLevel) ? 'treat' : 'monitor';
}

const toProductDto = ({ product, substances }: ProductView): RecommendationProductDto => ({
  id: product.id, name: product.name, registrationNumber: product.registrationNumber,
  activeSubstances: substances.map(({ code, nameUk, concentration, resistanceSystem, resistanceGroup }) => ({ code, nameUk, concentration, resistanceSystem, resistanceGroup })),
  pollinatorHazard: product.pollinatorHazard,
  zones: { water: product.waterProtectionZoneM, apiary: product.apiaryZoneM, settlement: product.settlementZoneM },
  isDemo: product.isDemo, source: product.source, verifiedAt: product.verifiedAt,
});

@Injectable()
export class RecommendationMapper {
  constructor(
    private readonly catalog: CatalogReader,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async toDto(recommendation: RecommendationEntity, items: RecommendationItemEntity[]): Promise<RecommendationDto> {
    const products = await this.catalog.loadProducts([...new Set(items.map((i) => i.productId))]);
    const approver = recommendation.approvedByUserId ? await this.users.findOne({ where: { id: recommendation.approvedByUserId } }) : null;
    const toItem = (item: RecommendationItemEntity): RecommendationItemDto => this.toItemDto(item, products.get(item.productId));
    const sorted = [...items].sort((a, b) => a.rank - b.rank);
    const forecast = recommendation.weatherForecast;
    return {
      id: recommendation.id, observationId: recommendation.observationId, diagnosisId: recommendation.confirmedDiagnosisId, status: recommendation.status,
      actionLevel: recommendation.actionLevel, recommendedAction: recommendedAction(recommendation),
      thresholdExceeded: recommendation.thresholdExceeded,
      weather: recommendation.weatherVerdict ? {
        verdict: recommendation.weatherVerdict, reason: recommendation.weatherReason,
        reasonParams: (forecast.reasonParams as Record<string, unknown>) ?? {},
        forecastSummary: { nextGoAt: forecast.nextGoAt ?? null, hours: forecast.hours ?? [] },
      } : null,
      safetyWarnings: recommendation.safetyWarnings,
      items: sorted.filter((i) => !i.excluded).map(toItem),
      excludedItems: sorted.filter((i) => i.excluded).map((i): ExcludedItemDto => ({ ...toItem(i), excludedReason: decodeReason(i.excludedReason) })),
      explanation: recommendation.explanation, sources: recommendation.sources, catalogVersion: recommendation.catalogVersion,
      catalogStale: recommendation.catalogStale, autoApproved: recommendation.autoApproved,
      approvedBy: recommendation.approvedByUserId ? { userId: recommendation.approvedByUserId, displayName: approver?.displayName ?? null } : null,
      approvedAt: recommendation.approvedAt ? new Date(recommendation.approvedAt).toISOString() : null,
      rejectionReason: recommendation.rejectionReason, disclaimerCode: DRAFT_DISCLAIMER_CODE,
      createdAt: new Date(recommendation.createdAt).toISOString(),
    };
  }

  private toItemDto(item: RecommendationItemEntity, product: ProductView | undefined): RecommendationItemDto {
    return {
      rank: item.rank, product: product ? toProductDto(product) : null, activeSubstanceCodes: item.activeSubstanceCodes,
      rate: { value: item.rateValue, unit: item.rateUnit }, applicationTiming: item.applicationTiming,
      bbchFrom: item.bbchFrom, bbchTo: item.bbchTo, preHarvestIntervalDays: item.preHarvestIntervalDays,
      resistance: { system: item.resistanceSystem, group: item.resistanceGroup, rotationOk: item.rotationOk, note: decodeReason(item.rotationNote) },
      stock: { inStock: item.inStock, quantity: item.stockQty, unit: item.stockUnit },
      costPerHaUah: item.costPerHaUah, score: item.score,
    };
  }
}
