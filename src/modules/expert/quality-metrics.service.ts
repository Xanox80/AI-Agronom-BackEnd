import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisResultEntity, ExpertCaseEntity, LabelEntity } from '../../domain/entities';
import { ExpertCaseStatus, LabelAction, LabelSource } from '../../domain/enums';

export interface QualityMetrics {
  diagnosedObservations: number;
  casesSentToExpert: number;
  resolvedCases: number;
  shareSentToExpert: number;
  expertConfirmationRate: number;
}

export interface QualityCounts {
  diagnosedObservations: number;
  casesSentToExpert: number;
  resolvedCases: number;
  expertConfirms: number;
  expertChanges: number;
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

export function toQualityMetrics(counts: QualityCounts): QualityMetrics {
  return {
    diagnosedObservations: counts.diagnosedObservations,
    casesSentToExpert: counts.casesSentToExpert,
    resolvedCases: counts.resolvedCases,
    shareSentToExpert: ratio(counts.casesSentToExpert, counts.diagnosedObservations),
    expertConfirmationRate: ratio(counts.expertConfirms, counts.expertConfirms + counts.expertChanges),
  };
}

@Injectable()
export class QualityMetricsService {
  constructor(
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(ExpertCaseEntity) private readonly cases: Repository<ExpertCaseEntity>,
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
  ) {}

  /** Cross-farm when farmId is omitted (expert role); otherwise limited to one farm. */
  async metrics(farmId?: string): Promise<QualityMetrics> {
    const tenant = farmId ? { farmId } : {};
    const diagnosed = await this.results
      .createQueryBuilder('r').select('COUNT(DISTINCT r.observationId)', 'n')
      .where(farmId ? 'r.farmId = :farmId' : '1=1', { farmId }).getRawOne<{ n: number }>();
    const expertLabels = (action: LabelAction) =>
      this.labels.createQueryBuilder('l')
        .innerJoin(ExpertCaseEntity, 'c', 'c.id = l.expertCaseId')
        .where('l.labelSource = :source AND l.action = :action', { source: LabelSource.Expert, action })
        .andWhere(farmId ? 'c.farmId = :farmId' : '1=1', { farmId }).getCount();

    return toQualityMetrics({
      diagnosedObservations: Number(diagnosed?.n ?? 0),
      casesSentToExpert: await this.cases.count({ where: tenant }),
      resolvedCases: await this.cases.count({ where: { ...tenant, status: ExpertCaseStatus.Resolved } }),
      expertConfirms: await expertLabels(LabelAction.Confirm),
      expertChanges: await expertLabels(LabelAction.Change),
    });
  }
}
