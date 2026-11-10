import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { LabelAction } from '../../domain/enums';
import { LabelEntity } from '../../domain/entities';
import { EXPERT_CONFIG, ExpertConfig } from './expert.config';

@Injectable()
export class RareClassService {
  constructor(
    @InjectRepository(LabelEntity) private readonly labels: Repository<LabelEntity>,
    @Inject(EXPERT_CONFIG) private readonly config: ExpertConfig,
  ) {}

  /** A class without a catalogue id, or with few labels so far, is rare. */
  async isRare(diagnosisId: string | null): Promise<boolean> {
    if (!diagnosisId) return true;
    const count = await this.labels.count({ where: { diagnosisId, action: Not(LabelAction.Reject) } });
    return count < this.config.rareClassMaxLabels;
  }
}
