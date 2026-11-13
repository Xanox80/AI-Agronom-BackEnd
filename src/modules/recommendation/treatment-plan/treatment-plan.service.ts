import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { TREATMENT_WRITER, TreatmentWriter, TreatmentWriterError } from './groq-treatment-writer';
import { TreatmentFactsLoader } from './treatment-facts.loader';
import { TREATMENT_PLAN_SETTINGS, TreatmentPlanSettings } from './treatment-plan.settings';
import { DraftPlan, TreatmentFacts, TreatmentPlanApplication, TreatmentPlanDto, TreatmentPlanStatus } from './treatment-plan.types';
import { validateTreatmentPlan } from './treatment-plan.validator';
import { workingSolution } from './working-solution';

const OBSERVE_ONLY = 'observe';

/**
 * Treatment course written by a Groq language model on top of the rules-engine recommendation. The model only
 * arranges registered products into a course; the registry limits are re-checked here and the proportions are
 * computed in code, so a wrong answer is rejected rather than shown.
 */
@Injectable()
export class TreatmentPlanService {
  private readonly logger = new Logger(TreatmentPlanService.name);

  constructor(
    private readonly facts: TreatmentFactsLoader,
    @Inject(TREATMENT_WRITER) private readonly writer: TreatmentWriter | null,
    @Inject(TREATMENT_PLAN_SETTINGS) private readonly settings: TreatmentPlanSettings,
  ) {}

  async generate(farmId: string, recommendationId: string, tankVolumeL?: number): Promise<TreatmentPlanDto> {
    if (!this.writer) throw new ServiceUnavailableException('TREATMENT_PLAN_DISABLED');
    const facts = await this.facts.load(farmId, recommendationId);
    if (facts.actionLevel === OBSERVE_ONLY || !facts.products.length) return this.result(recommendationId, 'no_treatment', null, facts, tankVolumeL, []);
    let answer: unknown;
    try {
      answer = await this.writer.write(facts);
    } catch (error) {
      if (!(error instanceof TreatmentWriterError)) throw error;
      this.logger.warn(error.message);
      throw new ServiceUnavailableException('TREATMENT_PLAN_UNAVAILABLE');
    }
    const { plan, errors } = validateTreatmentPlan(answer, facts);
    if (errors.length) this.logger.warn(`Rejected treatment plan for recommendation ${recommendationId}: ${errors.join('; ')}`);
    return this.result(recommendationId, plan ? 'ready' : 'rejected', plan, facts, tankVolumeL, errors);
  }

  private result(
    recommendationId: string, status: TreatmentPlanStatus, plan: DraftPlan | null, facts: TreatmentFacts,
    tankVolumeL: number | undefined, validationErrors: string[],
  ): TreatmentPlanDto {
    return {
      recommendationId, status, model: status === 'no_treatment' ? null : this.writer?.model ?? null,
      summary: plan?.summary ?? '', applications: plan ? this.withSolutions(plan, facts, tankVolumeL ?? this.settings.defaultTankVolumeL) : [],
      precautions: plan?.precautions ?? [], monitoring: plan?.monitoring ?? '', validationErrors,
      disclaimerCode: 'treatment_plan_needs_agronomist', generatedAt: new Date().toISOString(),
    };
  }

  private withSolutions(plan: DraftPlan, facts: TreatmentFacts, tankVolumeL: number): TreatmentPlanApplication[] {
    const products = new Map(facts.products.map((p) => [p.productId, p]));
    return [...plan.applications].sort((a, b) => a.dayOffset - b.dayOffset).map((application) => {
      const product = products.get(application.productId)!;
      return {
        ...application, productName: product.name, rateUnit: product.rateUnit,
        solution: workingSolution(application.rateValue, product.rateUnit, application.waterLPerHa, tankVolumeL, facts.areaHa),
      };
    });
  }
}
