import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogDiagnosisEntity, ObservationEntity, PhotoEntity, RecommendationEntity } from '../../domain/entities';
import { RecommendationStatus } from '../../domain/enums';
import { CreateTaskDto } from './dto/task-input.dto';

/** Checks that the observation, recommendation and diagnosis a task points to exist and belong to the farm. */
@Injectable()
export class TaskReferences {
  constructor(
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(RecommendationEntity) private readonly recommendations: Repository<RecommendationEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
  ) {}

  async validate(farmId: string, dto: Pick<CreateTaskDto, 'observationId' | 'recommendationId' | 'diagnosisId'>): Promise<void> {
    if (dto.observationId && !(await this.observations.exist({ where: { id: dto.observationId, farmId } }))) {
      throw new BadRequestException('Unknown observationId');
    }
    const approved = { id: dto.recommendationId, farmId, status: RecommendationStatus.Approved };
    if (dto.recommendationId && !(await this.recommendations.exist({ where: approved }))) {
      throw new BadRequestException('Unknown or not approved recommendationId');
    }
    if (dto.diagnosisId && !(await this.diagnoses.exist({ where: { id: dto.diagnosisId } }))) {
      throw new BadRequestException('Unknown diagnosisId');
    }
  }

  async observationPhotoIds(observationId: string): Promise<string[]> {
    const rows = await this.photos.find({ where: { observationId }, order: { seq: 'ASC' } });
    return rows.map((photo) => photo.id);
  }
}
