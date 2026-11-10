import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CatalogDiagnosisEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, ObservationEntity,
} from '../../domain/entities';
import { ProblemCategory } from '../../domain/enums';
import { AnalyticsSettings } from './analytics.settings';

export interface ResolvedDiagnosis {
  id: string | null;
  code: string;
  name: string;
  weight: number;
  problemCategory: ProblemCategory | null;
}

const TOP_RANK = 1;

/** The diagnosis of an observation: the confirmed one, else the top hypothesis of the latest result. */
@Injectable()
export class ObservationDiagnosisResolver {
  constructor(
    @InjectRepository(CatalogDiagnosisEntity) private readonly catalog: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    private readonly settings: AnalyticsSettings,
  ) {}

  async resolve(observations: ObservationEntity[]): Promise<Map<string, ResolvedDiagnosis>> {
    const resolved = new Map<string, ResolvedDiagnosis>();
    if (observations.length === 0) return resolved;

    const entries = await this.catalog.find();
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const byCode = new Map(entries.map((entry) => [entry.code, entry]));
    const fromCatalog = (entry: CatalogDiagnosisEntity, weight: number): ResolvedDiagnosis => ({
      id: entry.id, code: entry.code, name: entry.nameEn, weight, problemCategory: entry.problemCategory,
    });

    const unconfirmed: ObservationEntity[] = [];
    for (const observation of observations) {
      const confirmed = observation.confirmedDiagnosisId ? byId.get(observation.confirmedDiagnosisId) : undefined;
      if (confirmed) resolved.set(observation.id, fromCatalog(confirmed, this.settings.confirmedWeight));
      else unconfirmed.push(observation);
    }

    const top = await this.topHypotheses(unconfirmed.map((observation) => observation.id));
    for (const [observationId, hypothesis] of top) {
      const entry = byCode.get(hypothesis.diagnosisCode);
      resolved.set(observationId, entry
        ? fromCatalog(entry, hypothesis.probability)
        : { id: hypothesis.diagnosisId, code: hypothesis.diagnosisCode, name: hypothesis.diagnosisCode,
            weight: hypothesis.probability, problemCategory: null });
    }
    return resolved;
  }

  private async topHypotheses(observationIds: string[]): Promise<Map<string, DiagnosisHypothesisEntity>> {
    if (observationIds.length === 0) return new Map();
    const results = await this.results.find({ where: { observationId: In(observationIds) }, order: { createdAt: 'DESC' } });
    const latestResultByObservation = new Map<string, string>();
    for (const result of results) {
      if (!latestResultByObservation.has(result.observationId)) latestResultByObservation.set(result.observationId, result.id);
    }
    const resultIds = [...latestResultByObservation.values()];
    if (resultIds.length === 0) return new Map();

    const hypotheses = await this.hypotheses.find({ where: { diagnosisResultId: In(resultIds), rank: TOP_RANK } });
    const byResult = new Map(hypotheses.map((hypothesis) => [hypothesis.diagnosisResultId, hypothesis]));
    const top = new Map<string, DiagnosisHypothesisEntity>();
    for (const [observationId, resultId] of latestResultByObservation) {
      const hypothesis = byResult.get(resultId);
      if (hypothesis) top.set(observationId, hypothesis);
    }
    return top;
  }
}
