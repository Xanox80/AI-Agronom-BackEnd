import { parseClassMapping } from './class-mapping';

describe('parseClassMapping', () => {
  it('reads source and classes', () => {
    const mapping = parseClassMapping(JSON.stringify({
      source: 'plantvillage', classes: { Corn_healthy: { diagnosisCode: 'healthy_plant', cropCode: 'maize' } },
    }), 'm.json');

    expect(mapping.classes.Corn_healthy).toEqual({ diagnosisCode: 'healthy_plant', cropCode: 'maize' });
  });

  it('rejects a mapping without source', () => {
    expect(() => parseClassMapping('{"classes":{}}', 'm.json')).toThrow('"source"');
  });

  it('rejects a class without a crop code', () => {
    expect(() => parseClassMapping('{"source":"x","classes":{"A":{"diagnosisCode":"rust"}}}', 'm.json')).toThrow('class "A"');
  });
});
