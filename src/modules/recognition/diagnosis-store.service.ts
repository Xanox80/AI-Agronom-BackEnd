import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosisHypothesisEntity, DiagnosisResultEntity } from '../../domain/entities';
import { DiagnosisPass, Organ, PestStage, ProblemCategory } from '../../domain/enums';
import { PipelineResult } from './recognition-pipeline.service';

export interface SaveDiagnosis {
  observationId: string;
  farmId: string;
  pass: DiagnosisPass;
  providerName: string;
  modelVersion: string;
  calibrationTemperature: number;
  answers: Record<string, string>;
  /** photo seq by frame index, to turn a region's frame index into the stored photo seq */
  photoSeqs: number[];
  result: PipelineResult;
}

/** Persists one result per (observation, pass); a re-run replaces the row and its hypotheses. */
@Injectable()
export class DiagnosisStore {
  constructor(
    @InjectRepository(DiagnosisResultEntity) private readonly results: Repository<DiagnosisResultEntity>,
    @InjectRepository(DiagnosisHypothesisEntity) private readonly hypotheses: Repository<DiagnosisHypothesisEntity>,
  ) {}

  async save(input: SaveDiagnosis): Promise<DiagnosisResultEntity> {
    const { result } = input;
    const existing = await this.results.findOne({ where: { observationId: input.observationId, pass: input.pass } });
    const entity = Object.assign(existing ?? this.results.create({ observationId: input.observationId, pass: input.pass }), {
      farmId: input.farmId,
      providerName: input.providerName,
      modelVersion: input.modelVersion,
      cropCode: result.cropCode,
      organ: result.organ as Organ | null,
      problemCategory: result.problemCategory as ProblemCategory | null,
      calibrationTemperature: input.calibrationTemperature,
      entropy: result.entropy,
      unsure: result.unsure,
      unsureReason: result.unsureReason,
      outOfDistribution: result.outOfDistribution,
      pestSpecies: result.pest?.species ?? null,
      pestStage: (result.pest?.stage as PestStage | undefined) ?? null,
      pestDensityPerPlant: result.pest?.densityPerPlant ?? null,
      pestDensityPerM2: result.pest?.densityPerM2 ?? null,
      clarifyingQuestions: result.questions,
      answers: input.answers,
      rawResponse: result.rawResponse,
      latencyMs: result.latencyMs,
    });
    const saved = await this.results.save(entity);
    await this.hypotheses.delete({ diagnosisResultId: saved.id });
    await this.hypotheses.save(result.hypotheses.map((h) => this.hypotheses.create({
      diagnosisResultId: saved.id,
      rank: h.rank,
      diagnosisId: h.diagnosisId,
      diagnosisCode: h.diagnosisCode,
      rawProbability: h.rawProbability,
      probability: h.probability,
      stage: h.stage,
      evidence: h.evidence,
      regionX: h.region?.x ?? null,
      regionY: h.region?.y ?? null,
      regionW: h.region?.w ?? null,
      regionH: h.region?.h ?? null,
      regionPhotoSeq: h.region ? input.photoSeqs[h.region.photoIndex] ?? null : null,
    })));
    return saved;
  }

  findById(id: string, farmId: string): Promise<DiagnosisResultEntity | null> {
    return this.results.findOne({ where: { id, farmId } });
  }

  findLatest(observationId: string, farmId: string): Promise<DiagnosisResultEntity | null> {
    return this.results.findOne({ where: { observationId, farmId }, order: { updatedAt: 'DESC' } });
  }

  hypothesesOf(diagnosisResultId: string): Promise<DiagnosisHypothesisEntity[]> {
    return this.hypotheses.find({ where: { diagnosisResultId }, order: { rank: 'ASC' } });
  }
}
