import { PestStage } from '../../domain/enums';
import { VisionPest } from '../vision-provider/vision.types';
import { summarisePests } from './pest-summary';

const pest = (overrides: Partial<VisionPest>): VisionPest => ({
  species: 'aphid', stage: PestStage.Nymph, countVisible: 5, densityPerPlant: null, densityPerM2: null, ...overrides,
});

describe('summarisePests', () => {
  it('returns null without pest frames', () => {
    expect(summarisePests([], 100)).toBeNull();
  });

  it('averages per-plant density over the series and converts it to per m2 with the configured plant density', () => {
    const summary = summarisePests([pest({ densityPerPlant: 2 }), pest({ densityPerPlant: 4 })], 100);
    expect(summary?.densityPerPlant).toBe(3);
    expect(summary?.densityPerM2).toBe(300);
  });

  it('prefers the provider per-m2 value when it is given', () => {
    expect(summarisePests([pest({ densityPerPlant: 2, densityPerM2: 50 })], 100)?.densityPerM2).toBe(50);
  });

  it('picks species and stage by majority', () => {
    const summary = summarisePests([
      pest({ species: 'aphid', stage: PestStage.Larva }), pest({ species: 'thrips', stage: PestStage.Larva }),
      pest({ species: 'aphid', stage: PestStage.Imago }),
    ], 100);
    expect(summary).toMatchObject({ species: 'aphid', stage: PestStage.Larva });
  });

  it('leaves density null when no frame reports one', () => {
    expect(summarisePests([pest({})], 100)).toMatchObject({ densityPerPlant: null, densityPerM2: null });
  });
});
