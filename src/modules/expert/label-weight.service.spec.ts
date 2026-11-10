import { LabelSource, Role } from '../../domain/enums';
import { LabelWeightService } from './label-weight.service';

const config = { get: () => ({ trustWeights: { expert: 3, chief: 2, scout: 1, mechanic: 0.5 } }) };
const service = new LabelWeightService(config as never);

describe('LabelWeightService', () => {
  it('weights an expert above a scout', () => {
    expect(service.weightFor({ role: Role.Expert, trustWeight: 3 })).toBeGreaterThan(service.weightFor({ role: Role.Scout, trustWeight: 1 }));
  });

  it('respects a zero weight that mutes a labeller', () => {
    expect(service.weightFor({ role: Role.Expert, trustWeight: 0 })).toBe(0);
  });

  it('prefers the per-user override', () => {
    expect(service.weightFor({ role: Role.Scout, trustWeight: 2.5 })).toBe(2.5);
  });

  it('marks expert labels as expert source and everyone else as user', () => {
    expect(service.sourceFor(Role.Expert)).toBe(LabelSource.Expert);
    expect(service.sourceFor(Role.Mechanic)).toBe(LabelSource.User);
  });
});
