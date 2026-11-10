import { ActionLevel, RecommendationStatus, WeatherVerdict } from '../../domain/enums';
import { candidate, contextFor, productView, registration, threshold } from './__fixtures__/pipeline-fixtures';
import { ExplanationBuilder } from './pipeline/explanation.builder';
import { RecommendationAssembler, decodeReason, encodeReason } from './recommendation.assembler';

describe('RecommendationAssembler', () => {
  const assembler = new RecommendationAssembler(new ExplanationBuilder());
  const args = { observationId: 'obs-1', diagnosisResultId: 'res-1', locale: 'en' };

  function context() {
    const c = contextFor();
    c.actionLevel = ActionLevel.Treat;
    c.threshold = threshold();
    c.weather = { verdict: WeatherVerdict.Go, reason: 'ok', reasonParams: { a: 1 }, hours: [] };
    c.candidates = [
      candidate({ score: 0.7 }),
      candidate({ registration: registration({ id: 'reg-2' }), product: productView({ id: 'prod-2', name: 'Other' }), exclusion: { code: 'rotation_limit', params: { used: 2 } }, rotationOk: false }),
    ];
    return c;
  }

  it('creates a draft that is never auto-approved by default', () => {
    const { recommendation } = assembler.assemble(context(), args);
    expect(recommendation.status).toBe(RecommendationStatus.Draft);
    expect(recommendation.autoApproved).toBe(false);
    expect(recommendation.confirmedDiagnosisId).toBe('diag-1');
    expect(recommendation.catalogVersion).toBe(3);
  });

  it('ranks chosen items from 1 and keeps excluded items with rank 0 and a coded reason', () => {
    const { items } = assembler.assemble(context(), args);
    expect(items.map((i) => [i.rank, i.excluded])).toEqual([[1, false], [0, true]]);
    expect(decodeReason(items[1].excludedReason)).toEqual({ code: 'rotation_limit', params: { used: 2 } });
    expect(items[0].recommendationId).toBeDefined();
  });

  it('records sources with directory dates for the products, registrations and threshold used', () => {
    const { recommendation } = assembler.assemble(context(), args);
    expect(recommendation.sources).toEqual(expect.arrayContaining([
      { kind: 'demo_seed', ref: 'Registry', verifiedAt: '2026-01-01' },
      { kind: 'demo_seed', ref: 'Reg-1', verifiedAt: '2026-01-01' },
      { kind: 'demo_seed', ref: 'Threshold doc', verifiedAt: '2026-01-01' },
    ]));
  });

  it('stores the weather window and an explanation', () => {
    const { recommendation } = assembler.assemble(context(), args);
    expect(recommendation.weatherVerdict).toBe(WeatherVerdict.Go);
    expect(recommendation.explanation).toContain('Diagnosis: Brown rust');
  });

  it('stores no weather data when the window was not evaluated', () => {
    const c = context();
    c.weather = null;
    const { recommendation } = assembler.assemble(c, args);
    expect(recommendation.weatherVerdict).toBeNull();
    expect(recommendation.weatherForecast).toEqual({});
  });
});

describe('reason codec', () => {
  it('round-trips a reason', () => {
    expect(decodeReason(encodeReason({ code: 'x', params: { a: 1 } }))).toEqual({ code: 'x', params: { a: 1 } });
  });

  it('treats a plain string as a bare code', () => {
    expect(decodeReason('legacy')).toEqual({ code: 'legacy', params: {} });
  });

  it('returns null for an empty value', () => {
    expect(decodeReason(null)).toBeNull();
    expect(encodeReason(null)).toBeNull();
  });
});
