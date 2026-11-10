import { ActionLevel, RecommendationStatus, WeatherVerdict } from '../../../domain/enums';
import type { RecommendationSource, SafetyWarning } from '../../../domain/types';
import { Reason } from '../pipeline/pipeline-types';

export type RecommendedAction = 'monitor' | 'treat' | 'consult_expert';

export interface RecommendationProductDto {
  id: string; name: string; registrationNumber: string | null;
  activeSubstances: { code: string; nameUk: string; concentration: string; resistanceSystem: string; resistanceGroup: string }[];
  pollinatorHazard: string; zones: { water: number; apiary: number; settlement: number };
  isDemo: boolean; source: string; verifiedAt: string | null;
}

export interface RecommendationItemDto {
  rank: number; product: RecommendationProductDto | null; activeSubstanceCodes: string[];
  rate: { value: number; unit: string }; applicationTiming: string; bbchFrom: number; bbchTo: number;
  preHarvestIntervalDays: number;
  resistance: { system: string | null; group: string | null; rotationOk: boolean; note: Reason | null };
  stock: { inStock: boolean; quantity: number | null; unit: string | null };
  costPerHaUah: number | null; score: number;
}

export interface ExcludedItemDto extends RecommendationItemDto { excludedReason: Reason | null }

export interface RecommendationDto {
  id: string; observationId: string; diagnosisId: string | null; status: RecommendationStatus; actionLevel: ActionLevel;
  recommendedAction: RecommendedAction; thresholdExceeded: boolean | null;
  weather: { verdict: WeatherVerdict; reason: string | null; reasonParams: Record<string, unknown>; forecastSummary: Record<string, unknown> } | null;
  safetyWarnings: SafetyWarning[]; items: RecommendationItemDto[]; excludedItems: ExcludedItemDto[];
  explanation: string; sources: RecommendationSource[]; catalogVersion: number; catalogStale: boolean;
  autoApproved: boolean; approvedBy: { userId: string; displayName: string | null } | null; approvedAt: string | null;
  rejectionReason: string | null; disclaimerCode: string; createdAt: string;
}
