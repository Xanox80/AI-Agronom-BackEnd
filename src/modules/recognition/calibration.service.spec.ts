import { testConfig } from './__fixtures__/recognition-fixtures';
import { CalibrationService } from './calibration.service';

describe('CalibrationService', () => {
  const service = (overrides = {}) => new CalibrationService(testConfig(overrides));

  it('leaves probabilities unchanged at temperature 1', () => {
    expect(service().temperatureScale([0.6, 0.3, 0.1]).map((p) => +p.toFixed(6))).toEqual([0.6, 0.3, 0.1]);
  });

  it('softens the distribution when temperature is above 1 and keeps the sum at 1', () => {
    const scaled = service().temperatureScale([0.8, 0.2], 2);
    expect(scaled[0]).toBeLessThan(0.8);
    expect(scaled[0] + scaled[1]).toBeCloseTo(1);
  });

  it('sharpens the distribution when temperature is below 1', () => {
    expect(service().temperatureScale([0.7, 0.3], 0.5)[0]).toBeGreaterThan(0.7);
  });

  it('keeps zero probabilities at zero', () => {
    expect(service().temperatureScale([1, 0], 2)).toEqual([1, 0]);
  });

  it('gives entropy 0 for a certain class and 1 for a uniform one', () => {
    expect(service().normalizedEntropy([1, 0, 0])).toBeCloseTo(0);
    expect(service().normalizedEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(1);
  });

  it('gives entropy 0 for a single class', () => {
    expect(service().normalizedEntropy([1])).toBe(0);
  });

  it('raises critical classes by the recall bias and renormalises', () => {
    const biased = service({ criticalRecallBias: 0.5 }).favourCritical([0.5, 0.5], [true, false]);
    expect(biased[0]).toBeCloseTo(0.6);
    expect(biased[1]).toBeCloseTo(0.4);
  });
});
