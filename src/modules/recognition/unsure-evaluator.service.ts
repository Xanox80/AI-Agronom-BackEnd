import { Inject, Injectable } from '@nestjs/common';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';
import { UnsureReason } from './recognition.constants';

export interface UnsureContext {
  providerFailed: boolean;
  providerSaysOutOfDistribution: boolean;
  /** Even the closest labelled reference photo is too dissimilar (similarity module). */
  referencesSayOutOfDistribution?: boolean;
  topCodeKnown: boolean;
  topProbability: number;
  normalizedEntropy: number;
}

interface UnsureRule {
  reason: UnsureReason;
  applies(context: UnsureContext, config: RecognitionConfig): boolean;
}

/** Ordered: the first rule that fires names the reason (FR-8, 4.3 unknown detection). */
const UNSURE_RULES: UnsureRule[] = [
  { reason: UnsureReason.ProviderError, applies: (c) => c.providerFailed },
  { reason: UnsureReason.OutOfDistribution, applies: (c) => c.providerSaysOutOfDistribution },
  { reason: UnsureReason.OutOfDistribution, applies: (c) => !!c.referencesSayOutOfDistribution },
  { reason: UnsureReason.UnknownCode, applies: (c) => !c.topCodeKnown },
  { reason: UnsureReason.LowConfidence, applies: (c, cfg) => c.topProbability < cfg.unsureThreshold },
  { reason: UnsureReason.HighEntropy, applies: (c, cfg) => c.normalizedEntropy > cfg.oodEntropyThreshold },
];

@Injectable()
export class UnsureEvaluator {
  constructor(@Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig) {}

  reasonFor(context: UnsureContext): UnsureReason | null {
    return UNSURE_RULES.find((rule) => rule.applies(context, this.config))?.reason ?? null;
  }
}
