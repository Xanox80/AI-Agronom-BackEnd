import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CatalogDiagnosisEntity, DiagnosisHypothesisEntity, DiagnosisResultEntity, ExpertCaseEntity, LabelEntity, ObservationEntity,
  PhotoEntity, UserEntity,
} from '../../domain/entities';
import { DiagnosisPass, ExpertCaseReason, ExpertCaseStatus, LabelAction, LabelSource, Role } from '../../domain/enums';
import type { DiagnosisResultDto, HypothesisDto, ObservationDto, Page } from '../../domain/types';
import { ListCasesQuery } from './dto/list-cases.query';
import { EXPERT_CONFIG, ExpertConfig } from './expert.config';

export interface LabelDto {
  id: string; labelerName: string; labelerRole: Role | null; labelSource: LabelSource; action: LabelAction;
  diagnosisId?: string; affectedRegion?: LabelEntity['affectedRegion']; weight: number; comment?: string; createdAt: string;
}

export interface ExpertCaseDto {
  id: string; reason: ExpertCaseReason; status: ExpertCaseStatus; priority: number;
  observation: ObservationDto; diagnosis: DiagnosisResultDto;
  userCorrection?: { fromDiagnosisId: string; toDiagnosisId: string }; labels: LabelDto[]; createdAt: string;
}

@Injectable()
export class ExpertCaseQueryService {
  constructor(
    @InjectRepository(ExpertCaseEntity) private readonly cases: Repository<ExpertCaseEntity>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(EXPERT_CONFIG) private readonly config: ExpertConfig,
  ) {}

  /** The queue: highest priority first, then oldest. Cross-farm unless farmId is given. */
  async list(query: ListCasesQuery, farmId?: string): Promise<Page<ExpertCaseDto>> {
    const pageSize = Math.min(query.pageSize ?? this.config.defaultPageSize, this.config.maxPageSize);
    const qb = this.cases.createQueryBuilder('c')
      .leftJoin(ObservationEntity, 'o', 'o.id = c.observationId')
      .orderBy('c.priority', 'DESC').addOrderBy('c.createdAt', 'ASC')
      .skip((query.page - 1) * pageSize).take(pageSize);
    if (farmId) qb.andWhere('c.farmId = :farmId', { farmId });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.reason) qb.andWhere('c.reason = :reason', { reason: query.reason });
    if (query.cropId) qb.andWhere('o.cropId = :cropId', { cropId: query.cropId });
    const [rows, total] = await qb.getManyAndCount();
    const items = await Promise.all(rows.map((row) => this.toDto(row)));
    return { items, total, page: query.page, pageSize };
  }

  async get(id: string, farmId?: string): Promise<ExpertCaseDto> {
    const found = await this.cases.findOne({ where: { id, ...(farmId && { farmId }) } });
    if (!found) throw new NotFoundException('Expert case not found');
    return this.toDto(found);
  }

  async toDto(expertCase: ExpertCaseEntity): Promise<ExpertCaseDto> {
    const observation = await this.observations.findOneByOrFail({ id: expertCase.observationId });
    const photos = await this.photos.find({ where: { observationId: observation.id }, order: { seq: 'ASC' } });
    const result = await this.results.findOneByOrFail({ id: expertCase.diagnosisResultId });
    const hypotheses = await this.hypotheses.find({ where: { diagnosisResultId: result.id }, order: { rank: 'ASC' } });
    const names = await this.diagnosisNames(hypotheses);
    return {
      id: expertCase.id, reason: expertCase.reason, status: expertCase.status, priority: expertCase.priority,
      observation: this.observationDto(observation, photos),
      diagnosis: this.diagnosisDto(result, hypotheses, names),
      userCorrection: observation.correctedFromDiagnosisId && observation.confirmedDiagnosisId
        ? { fromDiagnosisId: observation.correctedFromDiagnosisId, toDiagnosisId: observation.confirmedDiagnosisId } : undefined,
      labels: await this.labelDtos(expertCase.id), createdAt: expertCase.createdAt.toISOString(),
    };
  }

  private async labelDtos(caseId: string): Promise<LabelDto[]> {
    const labels = await this.labels.find({ where: { expertCaseId: caseId }, order: { createdAt: 'ASC' } });
    const users = labels.length ? await this.users.find({ where: { id: In(labels.map((l) => l.labelerUserId)) } }) : [];
    return labels.map((label) => {
      const user = users.find((u) => u.id === label.labelerUserId);
      return {
        id: label.id, labelerName: user?.displayName ?? '', labelerRole: user?.role ?? null, labelSource: label.labelSource,
        action: label.action, diagnosisId: label.diagnosisId ?? undefined, affectedRegion: label.affectedRegion ?? undefined,
        weight: label.weight, comment: label.comment ?? undefined, createdAt: label.createdAt.toISOString(),
      };
    });
  }

  private async diagnosisNames(hypotheses: DiagnosisHypothesisEntity[]): Promise<Map<string, CatalogDiagnosisEntity>> {
    const ids = hypotheses.map((h) => h.diagnosisId).filter((id): id is string => !!id);
    const rows = ids.length ? await this.diagnoses.find({ where: { id: In(ids) } }) : [];
    return new Map(rows.map((row) => [row.id, row]));
  }

  private observationDto(o: ObservationEntity, photos: PhotoEntity[]): ObservationDto {
    return {
      id: o.id, clientId: o.clientId, fieldId: o.fieldId ?? undefined, fieldLinkMethod: o.fieldLinkMethod,
      cropId: o.cropId ?? undefined, bbchStage: o.bbchStage ?? undefined, capturedAt: o.capturedAt.toISOString(),
      temperatureC: o.temperatureC ?? undefined, humidityPct: o.humidityPct ?? undefined, organ: o.organ ?? undefined,
      textNote: o.textNote ?? undefined, scaleMarkerUsed: o.scaleMarkerUsed, isQuickCapture: o.isQuickCapture, status: o.status,
      confirmedDiagnosisId: o.confirmedDiagnosisId ?? undefined,
      photos: photos.map((p) => ({
        id: p.id, clientId: p.clientId, seq: p.seq, widthPx: p.widthPx, heightPx: p.heightPx,
        qualityReport: p.qualityReport, url: `/api/v1/photos/${p.id}/file`,
      })),
    };
  }

  private diagnosisDto(
    r: DiagnosisResultEntity, hypotheses: DiagnosisHypothesisEntity[], names: Map<string, CatalogDiagnosisEntity>,
  ): DiagnosisResultDto {
    return {
      id: r.id, observationId: r.observationId, pass: r.pass as DiagnosisPass, modelVersion: r.modelVersion,
      cropCode: r.cropCode ?? undefined, organ: r.organ ?? undefined, problemCategory: r.problemCategory ?? undefined,
      unsure: r.unsure, unsureReason: r.unsureReason ?? undefined, outOfDistribution: r.outOfDistribution,
      hypotheses: hypotheses.map((h) => this.hypothesisDto(h, names)), clarifyingQuestions: r.clarifyingQuestions,
      answers: r.answers, referenceImages: [], needsMorePhotos: false, createdAt: r.createdAt.toISOString(),
    };
  }

  private hypothesisDto(h: DiagnosisHypothesisEntity, names: Map<string, CatalogDiagnosisEntity>): HypothesisDto {
    const catalog = names.get(h.diagnosisId ?? '');
    const hasRegion = h.regionX !== null && h.regionY !== null && h.regionW !== null && h.regionH !== null;
    return {
      rank: h.rank, diagnosisId: h.diagnosisId ?? undefined, diagnosisCode: h.diagnosisCode,
      nameUk: catalog?.nameUk ?? h.diagnosisCode, nameEn: catalog?.nameEn ?? h.diagnosisCode,
      probability: h.probability, stage: h.stage ?? undefined, evidence: h.evidence,
      region: hasRegion ? { x: h.regionX!, y: h.regionY!, w: h.regionW!, h: h.regionH!, photoSeq: h.regionPhotoSeq ?? 1 } : undefined,
    };
  }
}
