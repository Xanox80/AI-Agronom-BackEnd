/** Codes the provider uses when no catalogue class fits. */
export const UNMAPPED_DIAGNOSIS_CODES: readonly string[] = ['other', 'unknown'];

export enum UnsureReason {
  ProviderError = 'provider_error',
  OutOfDistribution = 'out_of_distribution',
  UnknownCode = 'unknown_code',
  LowConfidence = 'low_confidence',
  HighEntropy = 'high_entropy',
}

export enum RecognitionStatus { Ok = 'ok', NeedsExpert = 'needs_expert' }

export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The answer option the UI adds to every clarifying question; it carries no information. */
export const UNSURE_ANSWER = 'unsure';
