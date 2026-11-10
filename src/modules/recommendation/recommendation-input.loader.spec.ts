import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProblemCategory } from '../../domain/enums';
import { settings, threshold, treatment } from './__fixtures__/pipeline-fixtures';
import { RecommendationInputLoader } from './recommendation-input.loader';

const NOW = new Date('2026-06-10T00:00:00Z');

interface Overrides {
  observation?: Record<string, unknown> | null; result?: Record<string, unknown> | null; field?: Record<string, unknown> | null;
  crop?: unknown; diagnosis?: unknown; hypothesis?: Record<string, unknown> | null; state?: unknown; oldestRow?: string;
}

function build(o: Overrides = {}) {
  const observation = o.observation === null ? null : { id: 'obs-1', fieldId: 'field-1', cropId: null, bbchStage: 40, lat: 50, lng: 30, confirmedDiagnosisId: null, ...o.observation };
  const repo = (row: unknown) => ({ findOne: jest.fn().mockResolvedValue(row), find: jest.fn() });
  const field = o.field === null ? null : { id: 'field-1', areaHa: 12, cropId: 'crop-1', sowingDate: '2025-10-01', centroidLat: 51, centroidLng: 31, nearWater: true, nearApiary: false, nearSettlement: false, ...o.field };
  const result = o.result === null ? null : { id: 'res-1', unsure: false, outOfDistribution: false, pestDensityPerPlant: null, pestDensityPerM2: 4, ...o.result };
  const hypothesis = o.hypothesis === undefined ? { diagnosisId: 'diag-1', probability: 0.8 } : o.hypothesis;
  const treatments = { find: jest.fn().mockResolvedValue([treatment()]) };
  const catalog = {
    findCrop: jest.fn().mockResolvedValue(o.crop === undefined ? { id: 'crop-1', code: 'wheat_winter' } : o.crop),
    findDiagnosis: jest.fn().mockResolvedValue(o.diagnosis === undefined ? {
      id: 'diag-1', code: 'brown_rust', nameUk: 'Бура іржа', nameEn: 'Brown rust', problemCategory: ProblemCategory.Disease, isQuarantine: false, isCritical: false,
    } : o.diagnosis),
    findThresholds: jest.fn().mockResolvedValue([threshold()]),
    oldestProductVerification: jest.fn().mockResolvedValue(o.oldestRow ?? null),
    findState: jest.fn().mockResolvedValue(o.state === undefined ? { version: 4, lastVerifiedAt: new Date('2026-05-01T00:00:00Z') } : o.state),
  };
  const loader = new RecommendationInputLoader(repo(observation) as never, repo(result) as never, repo(hypothesis) as never,
    repo(field) as never, treatments as never, repo({ regionCode: 'UA-N', defaultSafetyBuffers: { waterM: 1, apiaryM: 2, settlementM: 3 } }) as never,
    catalog as never, settings());
  return { loader, catalog, treatments };
}

describe('RecommendationInputLoader', () => {
  it('assembles the engine input from observation, diagnosis, field, history and catalogue', async () => {
    const { loader, treatments } = build();
    const { input, diagnosisResultId } = await loader.load('farm-1', { observationId: 'obs-1' }, NOW);
    expect(diagnosisResultId).toBe('res-1');
    expect(input.crop).toEqual({ id: 'crop-1', code: 'wheat_winter' });
    expect(input.diagnosis).toMatchObject({ id: 'diag-1', probability: 0.8, confirmed: false, pestDensityPerM2: 4 });
    expect(input.field).toMatchObject({ areaHa: 12, nearWater: true });
    expect(input.location).toEqual({ lat: 50, lng: 30 });
    expect(input.safetyBuffers).toEqual({ waterM: 1, apiaryM: 2, settlementM: 3 });
    expect(input.catalog).toEqual({ version: 4, verifiedAt: '2026-05-01', stale: false });
    expect(treatments.find).toHaveBeenCalled();
  });

  it('uses full probability for a diagnosis confirmed by the user', async () => {
    const { loader } = build({ observation: { confirmedDiagnosisId: 'diag-1' } });
    expect((await loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.diagnosis).toMatchObject({ confirmed: true, probability: 1 });
  });

  it('lets the request override the crop stage', async () => {
    const { loader } = build();
    expect((await loader.load('farm-1', { observationId: 'obs-1', bbchStage: 65 }, NOW)).input.bbch).toBe(65);
  });

  it('falls back to the field centroid when the observation has no coordinates', async () => {
    const { loader } = build({ observation: { lat: null, lng: null } });
    expect((await loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.location).toEqual({ lat: 51, lng: 31 });
  });

  it('falls back to the default region state when the farm region has no pack', async () => {
    const { loader, catalog } = build();
    catalog.findState.mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 7, lastVerifiedAt: new Date('2026-05-01T00:00:00Z') });
    expect((await loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.catalog.version).toBe(7);
  });

  it('flags the catalogue as stale when an old product row outweighs a fresh pack verification', async () => {
    const { loader } = build({ oldestRow: '2025-01-01' });
    expect((await loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.catalog.stale).toBe(true);
  });

  it('flags the catalogue as stale when it was verified too long ago or never', async () => {
    const old = build({ state: { version: 1, lastVerifiedAt: new Date('2025-01-01T00:00:00Z') } });
    expect((await old.loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.catalog.stale).toBe(true);
    const never = build({ state: null });
    expect((await never.loader.load('farm-1', { observationId: 'obs-1' }, NOW)).input.catalog).toEqual({ version: 0, verifiedAt: null, stale: true });
  });

  it('fails when the observation is not in the farm', async () => {
    await expect(build({ observation: null }).loader.load('farm-1', { observationId: 'x' }, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails when the observation has no diagnosis result yet', async () => {
    await expect(build({ result: null }).loader.load('farm-1', { observationId: 'obs-1' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when the crop cannot be determined', async () => {
    await expect(build({ crop: null }).loader.load('farm-1', { observationId: 'obs-1' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when the diagnosis is not in the catalogue', async () => {
    await expect(build({ diagnosis: null }).loader.load('farm-1', { observationId: 'obs-1' }, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });
});
