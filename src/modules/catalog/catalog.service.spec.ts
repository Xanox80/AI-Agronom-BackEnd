import { NotFoundException } from '@nestjs/common';
import { createCatalogContext } from './__fixtures__/catalog-test-context';

describe('CatalogService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  beforeEach(async () => { ctx = await createCatalogContext(); });
  afterEach(() => ctx.dataSource.destroy());

  const cropId = async (code: string) => (await ctx.catalog.listCrops()).find((c) => c.code === code)!.id;
  const diagnosisId = async (code: string) => (await ctx.catalog.getDiagnosisByCode(code))!.id;

  it('filters diagnoses by crop and category', async () => {
    const maize = await ctx.catalog.listDiagnoses({ cropId: await cropId('maize'), category: 'pest' as never });
    expect(maize.map((d) => d.code).sort()).toEqual(['european_corn_borer', 'spider_mite', 'western_corn_rootworm']);
  });

  it('searches diagnoses by Ukrainian name', async () => {
    expect((await ctx.catalog.listDiagnoses({ q: 'іржа' })).map((d) => d.code).sort()).toEqual(['wheat_leaf_rust', 'wheat_yellow_rust']);
  });

  it('flags the quarantine pest as critical', async () => {
    expect(await ctx.catalog.getDiagnosisByCode('western_corn_rootworm')).toMatchObject({ isQuarantine: true, isCritical: true });
  });

  it('returns thresholds whose BBCH range contains the stage', async () => {
    const rows = await ctx.catalog.getThresholds({ cropId: await cropId('rapeseed'), bbch: 55 });
    expect(rows.map((t) => t.metric).length).toBeGreaterThan(0);
    rows.forEach((t) => expect(t.bbchFrom <= 55 && t.bbchTo >= 55).toBe(true));
  });

  it('allows only registrations that match crop, diagnosis and BBCH, best efficacy first', async () => {
    const rows = await ctx.catalog.getAllowedRegistrations(await cropId('wheat_winter'), await diagnosisId('wheat_yellow_rust'), 40);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((r) => r.efficacyScore)).toEqual([...rows.map((r) => r.efficacyScore)].sort((a, b) => b - a));
    expect(await ctx.catalog.getAllowedRegistrations(await cropId('wheat_winter'), await diagnosisId('wheat_yellow_rust'), 90)).toEqual([]);
  });

  it('finds products by active substance and exposes resistance groups', async () => {
    const products = await ctx.catalog.listProducts({ activeSubstance: 'tebuconazole' });
    expect(products.map((p) => p.name).sort()).toEqual(['Folicur 250 EC', 'Prosaro 250 EC']);
    expect(products[0].activeSubstances.every((s) => s.resistanceSystem === 'FRAC')).toBe(true);
  });

  it('finds products registered for a crop and diagnosis', async () => {
    const products = await ctx.catalog.listProducts({ cropId: await cropId('maize'), diagnosisId: await diagnosisId('european_corn_borer') });
    expect(products.map((p) => p.name).sort()).toEqual(['Coragen 20 SC', 'Karate Zeon 050 CS']);
  });

  it('returns reference images and rejects unknown diagnoses', async () => {
    const images = await ctx.catalog.getReferenceImages(await diagnosisId('spider_mite'));
    expect(images[0]).toMatchObject({ diagnosisCode: 'spider_mite' });
    await expect(ctx.catalog.getReferenceImages('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
