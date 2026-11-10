import { Inject, Injectable } from '@nestjs/common';
import { RECOMMENDATION_SETTINGS, RecommendationSettings } from '../recommendation.settings';
import { STOCK_PROVIDER, StockAvailability, StockProvider } from '../../stock/stock-provider';
import { Candidate, PipelineContext, PipelineStep, TANK_MIX_WARNING, eligible, warn } from './pipeline-types';
import { convertQuantity } from './stock-units';
import { incompatiblePairs } from './tank-mix.check';

const FULL_SCORE = 1;

/** Step 5: ranks by efficacy, stock availability (FR-15) and cost per hectare with configured weights. */
@Injectable()
export class RankStep implements PipelineStep {
  constructor(
    @Inject(RECOMMENDATION_SETTINGS) private readonly settings: RecommendationSettings,
    @Inject(STOCK_PROVIDER) private readonly stock: StockProvider,
  ) {}

  async run(context: PipelineContext): Promise<void> {
    const candidates = eligible(context);
    const levels = await this.stock.getStock(context.input.farmId, [...new Set(candidates.map((c) => c.product.product.id))]);
    const areaHa = context.input.field?.areaHa ?? 0;
    const maxCost = Math.max(0, ...candidates.map((c) => c.costPerHaUah ?? 0));
    const { efficacy, stock, cost } = this.settings.rankWeights;

    for (const candidate of candidates) {
      const stockScore = this.applyStock(candidate, levels, areaHa);
      const costScore = candidate.costPerHaUah === null ? 0 : maxCost === 0 ? FULL_SCORE : FULL_SCORE - candidate.costPerHaUah / maxCost;
      candidate.score = efficacy * candidate.registration.efficacyScore + stock * stockScore + cost * costScore;
    }
    const ranked = candidates.sort((a, b) => b.score - a.score || a.product.product.name.localeCompare(b.product.product.name));
    const kept = ranked.slice(0, this.settings.maxItems);
    const dropped = ranked.slice(this.settings.maxItems);
    dropped.forEach((c) => { c.exclusion = { code: 'max_items_exceeded', params: { max: this.settings.maxItems } }; });
    incompatiblePairs(kept).forEach(([first, second]) => warn(context, TANK_MIX_WARNING, 'warning', { first, second }));
    context.candidates = [...kept, ...dropped, ...context.candidates.filter((c) => c.exclusion && !dropped.includes(c))];
  }

  private applyStock(candidate: Candidate, levels: StockAvailability[], areaHa: number): number {
    const own = levels.filter((l) => l.productId === candidate.product.product.id);
    if (own.length === 0) return 0;
    const converted = own.map((l) => convertQuantity(l.quantity, l.unit, candidate.registration.rateUnit));
    const quantity = converted.includes(null) ? null : (converted as number[]).reduce((sum, q) => sum + q, 0);
    const needed = candidate.rateValue * areaHa;
    candidate.stock = { inStock: quantity !== null && quantity > 0 && quantity >= needed, quantity: own.reduce((sum, l) => sum + l.quantity, 0), unit: own[0].unit };
    if (quantity === null || quantity <= 0) return 0;
    return needed > 0 ? Math.min(FULL_SCORE, quantity / needed) : FULL_SCORE;
  }
}
