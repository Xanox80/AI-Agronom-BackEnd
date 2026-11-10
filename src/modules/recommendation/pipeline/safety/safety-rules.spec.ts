import { PollinatorHazard } from '../../../../domain/enums';
import { candidate, pipelineInput, productView } from '../../__fixtures__/pipeline-fixtures';
import { PollinatorRule, apiaryBufferRule, settlementBufferRule, waterBufferRule } from './safety-rules';

const nearField = (flags: Partial<{ nearWater: boolean; nearApiary: boolean; nearSettlement: boolean }>) =>
  pipelineInput({ field: { id: 'f', areaHa: 5, sowingDate: null, nearWater: false, nearApiary: false, nearSettlement: false, ...flags } });

describe('ZoneBufferRule', () => {
  it('warns about the product water zone for a field near water', () => {
    const [warning] = waterBufferRule().evaluate(candidate({ product: productView({ waterProtectionZoneM: 100 }) }), nearField({ nearWater: true }));
    expect(warning).toMatchObject({ code: 'water_buffer', params: { zoneM: 100 } });
  });

  it('falls back to the farm default zone when the product has none', () => {
    const [warning] = settlementBufferRule().evaluate(candidate(), nearField({ nearSettlement: true }));
    expect(warning.params.zoneM).toBe(300);
  });

  it('is critical near an apiary for a product highly hazardous to pollinators', () => {
    const c = candidate({ product: productView({ pollinatorHazard: PollinatorHazard.High }) });
    const [warning] = apiaryBufferRule().evaluate(c, nearField({ nearApiary: true }));
    expect(warning).toMatchObject({ code: 'apiary_buffer', severity: 'critical', params: { zoneM: 4000 } });
  });

  it('yields nothing when the field is not near the protected object', () => {
    expect(waterBufferRule().evaluate(candidate(), nearField({}))).toEqual([]);
  });

  it('yields nothing when the field is unknown', () => {
    expect(waterBufferRule().evaluate(candidate(), pipelineInput({ field: null }))).toEqual([]);
  });
});

describe('PollinatorRule', () => {
  const rule = new PollinatorRule();
  const hazard = (pollinatorHazard: PollinatorHazard) => rule.evaluate(candidate({ product: productView({ pollinatorHazard }) }));

  it('is critical for a high hazard', () => expect(hazard(PollinatorHazard.High)[0].severity).toBe('critical'));
  it('warns for an unknown hazard', () => expect(hazard(PollinatorHazard.Unknown)[0].severity).toBe('warning'));
  it('stays silent for a low hazard', () => expect(hazard(PollinatorHazard.Low)).toEqual([]));
});
