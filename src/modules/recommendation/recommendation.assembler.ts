import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { RecommendationEntity, RecommendationItemEntity } from '../../domain/entities';
import { RecommendationStatus, ResistanceSystem } from '../../domain/enums';
import type { RecommendationSource } from '../../domain/types';
import { ExplanationBuilder } from './pipeline/explanation.builder';
import { Candidate, PipelineContext, Reason } from './pipeline/pipeline-types';

export interface AssemblyArguments {
  observationId: string; diagnosisResultId: string; locale: string;
}

export interface AssembledRecommendation { recommendation: RecommendationEntity; items: RecommendationItemEntity[] }

const NO_RANK = 0;

export const encodeReason = (reason: Reason | null): string | null => (reason ? JSON.stringify(reason) : null);

export function decodeReason(stored: string | null): Reason | null {
  if (!stored) return null;
  try { return JSON.parse(stored) as Reason; } catch { return { code: stored, params: {} }; }
}

/** Turns the finished pipeline context into persistable draft entities with explanation and sources (spec section 5, transparency). */
@Injectable()
export class RecommendationAssembler {
  constructor(private readonly explanation: ExplanationBuilder) {}

  assemble(context: PipelineContext, args: AssemblyArguments): AssembledRecommendation {
    const { input } = context;
    const id = randomUUID();
    const chosen = context.candidates.filter((c) => !c.exclusion);
    const sources = this.collectSources(context, chosen);
    const recommendation = Object.assign(new RecommendationEntity(), {
      id, farmId: input.farmId, observationId: args.observationId, diagnosisResultId: args.diagnosisResultId,
      confirmedDiagnosisId: input.diagnosis.id, status: RecommendationStatus.Draft, actionLevel: context.actionLevel,
      thresholdExceeded: context.thresholdExceeded, weatherVerdict: context.weather?.verdict ?? null,
      weatherReason: context.weather?.reason ?? null,
      weatherForecast: context.weather ? { reasonParams: context.weather.reasonParams, nextGoAt: context.weather.nextGoAt ?? null, hours: context.weather.hours } : {},
      safetyWarnings: context.warnings, explanation: this.explanation.build(context, sources, args.locale), sources,
      catalogVersion: input.catalog.version, catalogStale: input.catalog.stale, autoApproved: false,
      approvedByUserId: null, approvedAt: null, rejectionReason: null,
    });
    const items = [
      ...chosen.map((candidate, index) => this.toItem(id, candidate, index + 1)),
      ...context.candidates.filter((c) => c.exclusion).map((candidate) => this.toItem(id, candidate, NO_RANK)),
    ];
    return { recommendation, items };
  }

  private toItem(recommendationId: string, c: Candidate, rank: number): RecommendationItemEntity {
    const { registration, product } = c;
    const primary = product.substances.find((s) => s.resistanceSystem !== ResistanceSystem.None) ?? product.substances[0];
    return Object.assign(new RecommendationItemEntity(), {
      recommendationId, rank, productRegistrationId: registration.id, productId: product.product.id,
      activeSubstanceCodes: product.substances.map((s) => s.code), rateValue: c.rateValue, rateUnit: registration.rateUnit,
      applicationTiming: `BBCH ${registration.bbchFrom}-${registration.bbchTo}`, bbchFrom: registration.bbchFrom,
      bbchTo: registration.bbchTo, preHarvestIntervalDays: registration.preHarvestIntervalDays,
      resistanceSystem: primary?.resistanceSystem ?? null, resistanceGroup: primary?.resistanceGroup ?? null,
      rotationOk: c.rotationOk, rotationNote: encodeReason(c.rotationNote), stockQty: c.stock.quantity,
      stockUnit: c.stock.unit, inStock: c.stock.inStock, costPerHaUah: c.costPerHaUah,
      excluded: c.exclusion !== null, excludedReason: encodeReason(c.exclusion), score: c.score,
    });
  }

  private collectSources(context: PipelineContext, chosen: Candidate[]): RecommendationSource[] {
    const rows: { source: string; sourceRef: string | null; verifiedAt: string | null; fallbackRef: string }[] = chosen.flatMap((c) => [
      { ...c.product.product, fallbackRef: c.product.product.registrationNumber ?? c.product.product.name },
      { ...c.registration, fallbackRef: `${c.product.product.name} (registration)` },
    ]);
    if (context.threshold) rows.push({ ...context.threshold, fallbackRef: `threshold ${context.threshold.id}` });
    const unique = new Map<string, RecommendationSource>();
    for (const row of rows) {
      const source = { kind: row.source, ref: row.sourceRef ?? row.fallbackRef, verifiedAt: row.verifiedAt };
      unique.set(`${source.kind}|${source.ref}|${source.verifiedAt}`, source);
    }
    return [...unique.values()];
  }
}
