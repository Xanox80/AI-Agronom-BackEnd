import { ObservationEntity } from '../../domain/entities';
import { AnalyticsSettings } from './analytics.settings';
import { ObservationDiagnosisResolver } from './observation-diagnosis.resolver';

const CONFIRMED_WEIGHT = 1;
const catalog = [
  { id: 'd1', code: 'rust', nameEn: 'Rust', problemCategory: 'disease' },
  { id: 'd2', code: 'aphid', nameEn: 'Aphid', problemCategory: 'pest' },
];

describe('ObservationDiagnosisResolver', () => {
  const build = () => {
    const results = { find: jest.fn().mockResolvedValue([
      { id: 'r-new', observationId: 'o2', createdAt: 2 }, { id: 'r-old', observationId: 'o2', createdAt: 1 },
    ]) };
    const hypotheses = { find: jest.fn().mockResolvedValue([
      { diagnosisResultId: 'r-new', diagnosisCode: 'aphid', diagnosisId: 'd2', probability: 0.7 },
    ]) };
    return {
      hypotheses,
      resolver: new ObservationDiagnosisResolver(
        { find: jest.fn().mockResolvedValue(catalog) } as never, results as never, hypotheses as never,
        { confirmedWeight: CONFIRMED_WEIGHT } as AnalyticsSettings,
      ),
    };
  };
  const observation = (id: string, confirmedDiagnosisId: string | null) => ({ id, confirmedDiagnosisId }) as ObservationEntity;

  it('uses the confirmed diagnosis with the configured weight', async () => {
    const resolved = await build().resolver.resolve([observation('o1', 'd1')]);
    expect(resolved.get('o1')).toMatchObject({ id: 'd1', code: 'rust', weight: CONFIRMED_WEIGHT });
  });

  it('falls back to the top hypothesis of the latest result, weighted by probability', async () => {
    const { resolver, hypotheses } = build();
    const resolved = await resolver.resolve([observation('o2', null)]);
    expect(resolved.get('o2')).toMatchObject({ code: 'aphid', weight: 0.7 });
    expect(hypotheses.find.mock.calls[0][0].where.rank).toBe(1);
  });

  it('returns nothing for no observations', async () => {
    expect((await build().resolver.resolve([])).size).toBe(0);
  });
});
