import { frameOutput, hypothesis, testConfig } from './__fixtures__/recognition-fixtures';
import { MultiFrameAggregator } from './multi-frame-aggregator.service';

describe('MultiFrameAggregator', () => {
  const frames = [
    frameOutput([hypothesis('rust', 0.8), hypothesis('septoria', 0.2)]),
    frameOutput([hypothesis('rust', 0.4), hypothesis('septoria', 0.6)]),
  ];

  it('averages probabilities across frames in mean_prob mode', () => {
    const { hypotheses } = new MultiFrameAggregator(testConfig({ multiframeAggregation: 'mean_prob' })).aggregate(frames);
    expect(hypotheses.map((h) => [h.diagnosisCode, +h.rawProbability.toFixed(3)])).toEqual([['rust', 0.6], ['septoria', 0.4]]);
  });

  it('uses the geometric mean in mean_log_prob mode, never above the arithmetic mean', () => {
    const { hypotheses } = new MultiFrameAggregator(testConfig({ multiframeAggregation: 'mean_log_prob' })).aggregate(frames);
    expect(hypotheses[0].rawProbability).toBeCloseTo(Math.sqrt(0.8 * 0.4));
    expect(hypotheses.reduce((total, h) => total + h.rawProbability, 0)).toBeLessThanOrEqual(1);
  });

  it('counts a class missing from a frame as zero evidence', () => {
    const { hypotheses } = new MultiFrameAggregator(testConfig()).aggregate([
      frameOutput([hypothesis('rust', 0.8)]), frameOutput([hypothesis('septoria', 0.8)]),
    ]);
    expect(hypotheses[0].rawProbability).toBeCloseTo(0.4);
  });

  it('takes the region from the frame where the class scored highest and tags it with that frame index', () => {
    const region = { x: 0.1, y: 0.1, w: 0.2, h: 0.2, photoIndex: 0 };
    const { hypotheses } = new MultiFrameAggregator(testConfig()).aggregate([
      frameOutput([hypothesis('rust', 0.3)]), frameOutput([hypothesis('rust', 0.9, { region, evidence: 'pustules' })]),
    ]);
    expect(hypotheses[0].region).toEqual({ ...region, photoIndex: 1 });
    expect(hypotheses[0].evidence).toBe('pustules');
  });

  it('flags out of distribution only when most frames say so', () => {
    const aggregator = new MultiFrameAggregator(testConfig());
    const ood = frameOutput([], { outOfDistribution: true });
    expect(aggregator.aggregate([ood, frameOutput([hypothesis('rust', 0.9)])]).outOfDistribution).toBe(false);
    expect(aggregator.aggregate([ood, ood, frameOutput([hypothesis('rust', 0.9)])]).outOfDistribution).toBe(true);
  });

  it('takes crop, organ and category by majority and ignores unknown', () => {
    const result = new MultiFrameAggregator(testConfig()).aggregate([
      frameOutput([], { crop: 'unknown' }), frameOutput([], { crop: 'maize' }), frameOutput([], { crop: 'maize' }),
    ]);
    expect(result.cropCode).toBe('maize');
  });

  it('deduplicates clarifying questions by id', () => {
    const question = { id: 'q1', textUk: '', textEn: '', answerType: 'yes_no' as const, narrowsDiagnosisCodes: ['rust'] };
    const result = new MultiFrameAggregator(testConfig()).aggregate([
      frameOutput([], { clarifyingQuestions: [question] }), frameOutput([], { clarifyingQuestions: [question] }),
    ]);
    expect(result.questions).toHaveLength(1);
  });

  it('converts density per plant with the plant density of the detected crop', () => {
    const pest = { species: 'aphid', stage: 'imago' as never, countVisible: 1, densityPerPlant: 2, densityPerM2: null };
    const aggregate = (crop: string) => new MultiFrameAggregator(testConfig())
      .aggregate([frameOutput([], { crop, pest })]).pest?.densityPerM2;
    expect(aggregate('maize')).toBe(14);
    expect(aggregate('wheat_winter')).toBe(200);
  });
});
