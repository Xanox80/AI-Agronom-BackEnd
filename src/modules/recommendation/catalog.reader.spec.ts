import { CatalogReader } from './catalog.reader';

const repo = (rows: unknown[] = []) => ({ find: jest.fn().mockResolvedValue(rows), findOne: jest.fn().mockResolvedValue(rows[0] ?? null) });

function build(parts: Partial<Record<'products' | 'links' | 'substances' | 'registrations', unknown[]>> = {}) {
  const registrations = repo(parts.registrations);
  const reader = new CatalogReader(repo() as never, repo() as never, repo() as never, registrations as never,
    repo(parts.products) as never, repo(parts.links) as never, repo(parts.substances) as never, repo() as never);
  return { reader, registrations };
}

describe('CatalogReader', () => {
  it('finds registrations by crop and diagnosis', async () => {
    const { reader, registrations } = build({ registrations: [{ id: 'r1' }] });
    expect(await reader.findRegistrations('c', 'd')).toEqual([{ id: 'r1' }]);
    expect(registrations.find).toHaveBeenCalledWith({ where: { cropId: 'c', diagnosisId: 'd' } });
  });

  it('joins products with their active substances and resistance groups', async () => {
    const { reader } = build({
      products: [{ id: 'p1', name: 'Fungex' }],
      links: [{ productId: 'p1', activeSubstanceId: 's1', concentration: '250 g/l' }],
      substances: [{ id: 's1', code: 'tebuconazole', nameUk: 'Тебуконазол', resistanceSystem: 'FRAC', resistanceGroup: '3', maxApplicationsPerSeason: 2 }],
    });
    const views = await reader.loadProducts(['p1']);
    expect(views.get('p1')?.substances).toEqual([expect.objectContaining({ code: 'tebuconazole', resistanceGroup: '3', concentration: '250 g/l' })]);
  });

  it('returns an empty map without querying when no product ids are given', async () => {
    expect((await build().reader.loadProducts([])).size).toBe(0);
  });

  it('keeps a product that has no linked substances', async () => {
    const { reader } = build({ products: [{ id: 'p1' }] });
    expect((await reader.loadProducts(['p1'])).get('p1')?.substances).toEqual([]);
  });
});
