import { Inject, Injectable } from '@nestjs/common';
import { RECOGNITION_CONFIG, RecognitionConfig } from './recognition.config';

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

@Injectable()
export class CalibrationService {
  constructor(@Inject(RECOGNITION_CONFIG) private readonly config: RecognitionConfig) {}

  /** Temperature scaling on log scores (softmax(log p / T)) then renormalise; T > 1 softens, T < 1 sharpens. */
  temperatureScale(probabilities: number[], temperature = this.config.calibrationTemperature): number[] {
    const scaled = probabilities.map((p) => (p > 0 ? Math.pow(p, 1 / temperature) : 0));
    return this.normalise(scaled);
  }

  /** Entropy divided by its maximum for this many classes, so 0 is certain and 1 is uniform. */
  normalizedEntropy(probabilities: number[]): number {
    if (probabilities.length < 2) return 0;
    const entropy = -sum(probabilities.map((p) => (p > 0 ? p * Math.log(p) : 0)));
    return entropy / Math.log(probabilities.length);
  }

  /** Favours recall on critical classes by scaling their mass up, then renormalises. */
  favourCritical(probabilities: number[], critical: boolean[]): number[] {
    const factor = 1 + this.config.criticalRecallBias;
    return this.normalise(probabilities.map((p, i) => (critical[i] ? p * factor : p)));
  }

  private normalise(values: number[]): number[] {
    const total = sum(values);
    return total > 0 ? values.map((value) => value / total) : values;
  }
}
