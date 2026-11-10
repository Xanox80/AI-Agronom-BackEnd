import { DiagnosisPass } from '../../../domain/enums';
import { RecognitionService } from '../../recognition/recognition.service';
import { RecognitionObservationRefiner } from './recognition-observation-refiner';

describe('RecognitionObservationRefiner', () => {
  it('runs the server_refined pass for the observation', async () => {
    const diagnose = jest.fn().mockResolvedValue({});
    const refiner = new RecognitionObservationRefiner({ diagnose } as unknown as RecognitionService);

    await refiner.refine('obs-1', 'farm-1');

    expect(diagnose).toHaveBeenCalledWith('obs-1', 'farm-1', DiagnosisPass.ServerRefined);
  });
});
