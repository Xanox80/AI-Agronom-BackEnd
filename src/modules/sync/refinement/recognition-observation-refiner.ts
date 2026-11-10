import { Injectable } from '@nestjs/common';
import { DiagnosisPass } from '../../../domain/enums';
import { RecognitionService } from '../../recognition/recognition.service';
import { ObservationRefiner } from './observation-refiner';

/** Refinement through be-recognition: a `server_refined` diagnosis that the next pull delivers. */
@Injectable()
export class RecognitionObservationRefiner implements ObservationRefiner {
  constructor(private readonly recognition: RecognitionService) {}

  async refine(observationId: string, farmId: string): Promise<void> {
    await this.recognition.diagnose(observationId, farmId, DiagnosisPass.ServerRefined);
  }
}
