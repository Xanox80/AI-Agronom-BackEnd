import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabelAction, LabelSource } from '../../domain/enums';
import { LabelEntity, ObservationEntity, UserEntity } from '../../domain/entities';
import { ExpertCaseService } from './expert-case.service';
import { LabelWeightService } from './label-weight.service';

export interface UserFeedback {
  observationId: string;
  userId: string;
  farmId: string;
  finalDiagnosisId: string;
  correctedFromModel: boolean;
}

@Injectable()
export class UserFeedbackService {
  constructor(
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
    @InjectRepository(ObservationEntity) private readonly observations: Repository<ObservationEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly cases: ExpertCaseService,
    private readonly weights: LabelWeightService,
  ) {}

  /** One user label per user and observation; a disagreement opens an expert case, a label with no open case is exportable at once. */
  async record(feedback: UserFeedback): Promise<void> {
    const observation = await this.observations.findOne({ where: { id: feedback.observationId, farmId: feedback.farmId } });
    const user = await this.users.findOne({ where: { id: feedback.userId } });
    if (!observation || !user) throw new NotFoundException('Observation not found');

    const expertCase = feedback.correctedFromModel
      ? await this.cases.openForDisagreement(observation.id)
      : await this.cases.findUnresolved(observation.id);
    const existing = await this.labels.findOne({
      where: { observationId: observation.id, labelerUserId: user.id, labelSource: LabelSource.User },
    });
    await this.labels.save(this.labels.create({
      ...existing,
      observationId: observation.id, labelerUserId: user.id, labelSource: LabelSource.User,
      expertCaseId: expertCase?.id ?? null, diagnosisId: feedback.finalDiagnosisId,
      weight: this.weights.weightFor(user), action: feedback.correctedFromModel ? LabelAction.Change : LabelAction.Confirm,
      inDataset: !expertCase,
    }));
  }
}
