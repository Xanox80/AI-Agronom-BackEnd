import { ActionLevel, WeatherVerdict } from '../../../domain/enums';
import { candidate, contextFor } from '../__fixtures__/pipeline-fixtures';
import { ExplanationBuilder } from './explanation.builder';

const sources = [{ kind: 'registry', ref: 'UA-001', verifiedAt: '2026-01-01' }];

function treatedContext() {
  const context = contextFor();
  context.actionLevel = ActionLevel.Treat;
  context.actionReason = { code: 'above_threshold', params: { density: 12, threshold: 10, unit: 'pcs/m2' } };
  context.candidates = [candidate()];
  return context;
}

describe('ExplanationBuilder', () => {
  const builder = new ExplanationBuilder();

  it('explains the diagnosis, the action level and the reason in Ukrainian by default', () => {
    const text = builder.build(treatedContext(), sources, 'uk');
    expect(text).toContain('Діагноз: Бура іржа, ймовірність 90%');
    expect(text).toContain('Рівень дії: обробка.');
    expect(text).toContain('Щільність 12 pcs/m2 досягла ЕПШ 10.');
  });

  it('writes the same explanation in English on request', () => {
    const text = builder.build(treatedContext(), sources, 'en');
    expect(text).toContain('Diagnosis: Brown rust');
    expect(text).toContain('Action level: treat.');
  });

  it('falls back to Ukrainian for an unsupported locale', () => {
    expect(builder.build(treatedContext(), sources, 'de')).toContain('Рівень дії');
  });

  it('lists products with rate, pre-harvest interval and substances', () => {
    expect(builder.build(treatedContext(), sources, 'en')).toContain('1. Fungex: 1 l/ha, PHI 30 d, active substances: tebuconazole.');
  });

  it('lists excluded products with the reason', () => {
    const context = treatedContext();
    context.candidates.push(candidate({ exclusion: { code: 'rotation_limit', params: { system: 'FRAC', group: '3', used: 2, max: 2 } } }));
    expect(builder.build(context, sources, 'en')).toContain('Excluded Fungex: Group FRAC 3 already used 2 of 2 times: rotate.');
  });

  it('mentions the weather verdict and the next suitable window', () => {
    const context = treatedContext();
    context.weather = { verdict: WeatherVerdict.Wait, reason: 'wind', reasonParams: {}, nextGoAt: '2026-06-11T06:00', hours: [] };
    const text = builder.build(context, sources, 'en');
    expect(text).toContain('Weather window: wait.');
    expect(text).toContain('Next suitable window: 2026-06-11T06:00.');
  });

  it('shows sources, the catalogue date and the draft notice', () => {
    const text = builder.build(treatedContext(), sources, 'en');
    expect(text).toContain('Sources: UA-001.');
    expect(text).toContain('Reference data is current as of 2026-01-01.');
    expect(text).toContain('Draft: requires agronomist approval.');
  });

  it('flags stale reference data', () => {
    const context = treatedContext();
    context.input.catalog.stale = true;
    expect(builder.build(context, sources, 'en')).toContain('stale');
  });

  it('renders safety warnings with their parameters', () => {
    const context = treatedContext();
    context.warnings.push({ code: 'water_buffer', severity: 'warning', params: { productName: 'Fungex', zoneM: 100 } });
    expect(builder.build(context, sources, 'en')).toContain('Fungex: water protection zone 100 m.');
  });
});
