import { CatalogReader } from './catalog-reader.service';

describe('CatalogReader', () => {
  const image = (id: string, diagnosisId: string, cropId: string | null) => ({ id, diagnosisId, cropId });
  const images = { find: jest.fn().mockResolvedValue([image('a', 'd1', 'other'), image('b', 'd1', null), image('c', 'd1', 'c1'), image('d', 'd1', 'c1')]) };
  const reader = new CatalogReader({} as never, images as never, { findOne: jest.fn().mockResolvedValue({ id: 'c1' }) } as never);

  it('returns crop-specific references first and limits per diagnosis', async () => {
    const found = await reader.referenceImages(['d1'], 'wheat', 3);
    expect(found.get('d1')?.map((i) => i.id)).toEqual(['c', 'd', 'b']);
  });

  it('offers every code when the crop is unknown and filters by crop otherwise', () => {
    const catalog = new Map([
      ['rust', { code: 'rust', crops: [{ code: 'wheat' }] }],
      ['blight', { code: 'blight', crops: [{ code: 'potato' }] }],
    ]) as never;
    expect(reader.allowedCodes(catalog, undefined)).toEqual(['rust', 'blight']);
    expect(reader.allowedCodes(catalog, 'wheat')).toEqual(['rust']);
  });
});
