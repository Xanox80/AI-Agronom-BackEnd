import { ActionLevel, RecommendationStatus, WeatherVerdict } from '../../domain/enums';
import { RecommendationEntity, RecommendationItemEntity } from '../../domain/entities';
import { productView } from './__fixtures__/pipeline-fixtures';
import { DRAFT_DISCLAIMER_CODE, RecommendationMapper, recommendedAction } from './recommendation.mapper';

const recommendation = (overrides: Partial<RecommendationEntity> = {}) => Object.assign(new RecommendationEntity(), {
  id: 'rec-1', observationId: 'obs-1', status: RecommendationStatus.Draft, actionLevel: ActionLevel.Treat,
  thresholdExceeded: true, weatherVerdict: WeatherVerdict.Go, weatherReason: 'weather.go',
  weatherForecast: { reasonParams: {}, nextGoAt: null, hours: [] }, safetyWarnings: [], explanation: 'why', sources: [],
  catalogVersion: 2, catalogStale: false, autoApproved: false, approvedByUserId: null, approvedAt: null, rejectionReason: null,
  createdAt: new Date('2026-06-10T00:00:00Z'), ...overrides,
}) as RecommendationEntity;

const item = (overrides: Partial<RecommendationItemEntity> = {}) => Object.assign(new RecommendationItemEntity(), {
  rank: 1, productId: 'prod-1', activeSubstanceCodes: ['tebuconazole'], rateValue: 1, rateUnit: 'l/ha', applicationTiming: 'BBCH 30-69',
  bbchFrom: 30, bbchTo: 69, preHarvestIntervalDays: 30, resistanceSystem: 'FRAC', resistanceGroup: '3', rotationOk: true,
  rotationNote: null, stockQty: 20, stockUnit: 'l', inStock: true, costPerHaUah: 500, excluded: false, excludedReason: null, score: 0.8, ...overrides,
}) as RecommendationItemEntity;

function mapper(approver: { displayName: string } | null = null) {
  const catalog = { loadProducts: jest.fn().mockResolvedValue(new Map([['prod-1', productView()]])) };
  const users = { findOne: jest.fn().mockResolvedValue(approver) };
  return new RecommendationMapper(catalog as never, users as never);
}

describe('RecommendationMapper', () => {
  it('splits ranked items and excluded items with the decoded exclusion reason', async () => {
    const excluded = item({ rank: 0, excluded: true, excludedReason: JSON.stringify({ code: 'rotation_limit', params: { used: 2 } }) });
    const dto = await mapper().toDto(recommendation(), [excluded, item()]);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].product?.name).toBe('Fungex');
    expect(dto.excludedItems[0].excludedReason).toEqual({ code: 'rotation_limit', params: { used: 2 } });
  });

  it('exposes the weather verdict, the disclaimer and the approver name', async () => {
    const approved = recommendation({ status: RecommendationStatus.Approved, approvedByUserId: 'u1', approvedAt: new Date('2026-06-11T00:00:00Z') });
    const dto = await mapper({ displayName: 'Chief' }).toDto(approved, []);
    expect(dto.weather?.verdict).toBe(WeatherVerdict.Go);
    expect(dto.disclaimerCode).toBe(DRAFT_DISCLAIMER_CODE);
    expect(dto.approvedBy).toEqual({ userId: 'u1', displayName: 'Chief' });
    expect(dto.approvedAt).toBe('2026-06-11T00:00:00.000Z');
  });

  it('returns no weather block when the window was not evaluated', async () => {
    const dto = await mapper().toDto(recommendation({ weatherVerdict: null }), []);
    expect(dto.weather).toBeNull();
  });
});

describe('recommendedAction', () => {
  it('is treat for the treat and urgent levels', () => {
    expect(recommendedAction(recommendation())).toBe('treat');
    expect(recommendedAction(recommendation({ actionLevel: ActionLevel.Urgent }))).toBe('treat');
  });

  it('is monitor for the observe and threshold levels', () => {
    expect(recommendedAction(recommendation({ actionLevel: ActionLevel.Observe }))).toBe('monitor');
    expect(recommendedAction(recommendation({ actionLevel: ActionLevel.Threshold }))).toBe('monitor');
  });

  it('is consult_expert when the engine asked for an expert', () => {
    expect(recommendedAction(recommendation({ safetyWarnings: [{ code: 'consult_expert', params: {}, severity: 'warning' }] }))).toBe('consult_expert');
  });
});
