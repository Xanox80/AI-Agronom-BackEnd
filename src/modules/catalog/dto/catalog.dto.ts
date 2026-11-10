import type { ProblemCategory, ThresholdMetric, PollinatorHazard, RateUnit, ResistanceSystem } from '../../../domain/enums';
import type { QuestionDto, ReferenceImageDto } from '../../../domain/types';

export type { ReferenceImageDto };

export interface CropDto { id: string; code: string; nameUk: string; nameEn: string }

export interface BbchStageDto { id: string; cropId: string; bbchFrom: number; bbchTo: number; nameUk: string; nameEn: string; phase: string }

export interface CatalogDiagnosisDto {
  id: string; code: string; nameUk: string; nameEn: string; latinName: string | null; problemCategory: ProblemCategory;
  isQuarantine: boolean; isCritical: boolean; typicalOrgans: string[]; descriptionUk: string; descriptionEn: string;
  cropIds: string[]; clarifyingQuestions: QuestionDto[]; source: string; verifiedAt: string | null; isDemo: boolean;
}

export interface ThresholdDto {
  id: string; diagnosisId: string; cropId: string; bbchFrom: number; bbchTo: number; metric: ThresholdMetric;
  thresholdValue: number; urgentValue: number | null; unit: string; source: string; verifiedAt: string | null; isDemo: boolean;
}

export interface ActiveSubstanceDto {
  id: string; code: string; nameUk: string; nameEn: string; resistanceSystem: ResistanceSystem; resistanceGroup: string;
  maxApplicationsPerSeason: number | null; source: string; verifiedAt: string | null;
}

export interface ProductSubstanceDto {
  code: string; nameUk: string; concentration: string; resistanceSystem: ResistanceSystem; resistanceGroup: string;
}

export interface ProductDto {
  id: string; name: string; registrationNumber: string | null; activeSubstances: ProductSubstanceDto[];
  pollinatorHazard: PollinatorHazard; zones: { water: number; apiary: number; settlement: number };
  pricePerHaUah: number | null; isDemo: boolean; source: string; verifiedAt: string | null;
}

export interface ProductRegistrationDto {
  id: string; productId: string; cropId: string; diagnosisId: string; rateMin: number; rateMax: number; rateUnit: RateUnit;
  maxApplications: number; minIntervalDays: number; preHarvestIntervalDays: number; bbchFrom: number; bbchTo: number;
  efficacyScore: number; incompatibleWith: string[]; maxWindSpeedMs: number | null; minTempC: number | null;
  maxTempC: number | null; source: string; verifiedAt: string | null; isDemo: boolean;
}

export interface CatalogStatusDto {
  regionCode: string; version: number; publishedAt: string; lastVerifiedAt: string; daysSinceVerified: number;
  stale: boolean; staleAfterDays: number; containsDemoData: boolean; oldestRowVerifiedAt: string | null;
}

export interface CatalogPackDto {
  regionCode: string; version: number; publishedAt: string; sinceVersion: number | null;
  crops: CropDto[]; bbch: BbchStageDto[]; diagnoses: CatalogDiagnosisDto[]; thresholds: ThresholdDto[];
  products: ProductDto[]; registrations: ProductRegistrationDto[]; activeSubstances: ActiveSubstanceDto[];
  referenceImages: ReferenceImageDto[]; deleted: Record<string, string[]>;
}
