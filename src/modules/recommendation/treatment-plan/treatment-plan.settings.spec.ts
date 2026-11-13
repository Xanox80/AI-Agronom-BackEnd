import { buildTreatmentPlanSettings } from './treatment-plan.settings';

describe('buildTreatmentPlanSettings', () => {
  it('uses a Groq text model and common sprayer volumes by default', () => {
    expect(buildTreatmentPlanSettings('key', {})).toEqual({
      groqApiKey: 'key', model: 'openai/gpt-oss-120b', temperature: 0.2, timeoutMs: 45000,
      waterLPerHa: { min: 100, max: 400 }, defaultTankVolumeL: 3000,
    });
  });

  it('takes the model and limits from the environment', () => {
    const settings = buildTreatmentPlanSettings('', { TREATMENT_PLAN_MODEL: 'llama', TREATMENT_PLAN_WATER_MIN_L_PER_HA: '150', TREATMENT_PLAN_DEFAULT_TANK_L: '2000' });
    expect(settings).toMatchObject({ groqApiKey: '', model: 'llama', waterLPerHa: { min: 150, max: 400 }, defaultTankVolumeL: 2000 });
  });

  it('rejects a water range that cannot hold any volume', () => {
    expect(() => buildTreatmentPlanSettings('k', { TREATMENT_PLAN_WATER_MIN_L_PER_HA: '500' })).toThrow('TREATMENT_PLAN_WATER_MIN_L_PER_HA');
  });
});
