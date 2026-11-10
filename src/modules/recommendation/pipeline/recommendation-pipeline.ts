import { Injectable } from '@nestjs/common';
import { ActionLevelStep } from './action-level.step';
import { AllowedProductsStep } from './allowed-products.step';
import { FilterStep } from './filter.step';
import { PipelineContext, PipelineInput, PipelineStep, newContext } from './pipeline-types';
import { RankStep } from './rank.step';
import { SafetyWeatherStep } from './safety-weather.step';

/** Runs the deterministic engine steps (spec section 5) in order until one of them stops the pipeline. */
@Injectable()
export class RecommendationPipeline {
  private readonly steps: PipelineStep[];

  constructor(actionLevel: ActionLevelStep, allowed: AllowedProductsStep, filter: FilterStep, safetyWeather: SafetyWeatherStep, rank: RankStep) {
    this.steps = [actionLevel, allowed, filter, safetyWeather, rank];
  }

  async run(input: PipelineInput): Promise<PipelineContext> {
    const context = newContext(input);
    for (const step of this.steps) {
      await step.run(context);
      if (context.stopped) break;
    }
    return context;
  }
}
