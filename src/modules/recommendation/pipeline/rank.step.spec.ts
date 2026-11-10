import { StockProvider } from '../../stock/stock-provider';
import { candidate, contextFor, productView, registration, settings } from '../__fixtures__/pipeline-fixtures';
import { RankStep } from './rank.step';

const stockOf = (levels: { productId: string; quantity: number }[]): StockProvider => ({
  getStock: jest.fn().mockResolvedValue(levels.map((l) => ({ ...l, inStock: l.quantity > 0, unit: 'l' }))),
});

const named = (id: string, efficacy: number, price: number | null) => candidate({
  registration: registration({ id: `reg-${id}`, productId: id, efficacyScore: efficacy }),
  product: productView({ id, name: id }), costPerHaUah: price,
});

describe('RankStep', () => {
  it('ranks by the weighted score of efficacy, stock and cost', async () => {
    const context = contextFor();
    context.candidates = [named('cheap', 0.6, 100), named('strong', 0.9, 1000)];
    await new RankStep(settings({ rankWeights: { efficacy: 1, stock: 0, cost: 0 } }), stockOf([])).run(context);
    expect(context.candidates.map((c) => c.product.product.id)).toEqual(['strong', 'cheap']);
  });

  it('prefers the cheaper product when efficacy is equal and cost is weighted', async () => {
    const context = contextFor();
    context.candidates = [named('dear', 0.8, 1000), named('cheap', 0.8, 100)];
    await new RankStep(settings({ rankWeights: { efficacy: 0, stock: 0, cost: 1 } }), stockOf([])).run(context);
    expect(context.candidates[0].product.product.id).toBe('cheap');
  });

  it('prefers the product that is in stock and records the stock level', async () => {
    const context = contextFor();
    context.candidates = [named('a', 0.8, 100), named('b', 0.8, 100)];
    await new RankStep(settings({ rankWeights: { efficacy: 0, stock: 1, cost: 0 } }), stockOf([{ productId: 'b', quantity: 100 }])).run(context);
    expect(context.candidates[0].product.product.id).toBe('b');
    expect(context.candidates[0].stock).toEqual({ inStock: true, quantity: 100, unit: 'l' });
  });

  it('marks stock as insufficient when it does not cover rate times area', async () => {
    const context = contextFor();
    context.candidates = [named('a', 0.8, 100)];
    await new RankStep(settings(), stockOf([{ productId: 'a', quantity: 5 }])).run(context);
    expect(context.candidates[0].stock.inStock).toBe(false);
  });

  it('keeps only the configured number of items and appends excluded ones for transparency', async () => {
    const context = contextFor();
    const excluded = candidate({ exclusion: { code: 'rotation_limit', params: {} } });
    context.candidates = [named('a', 0.9, 1), named('b', 0.8, 1), named('c', 0.7, 1), excluded];
    await new RankStep(settings({ maxItems: 2 }), stockOf([])).run(context);
    expect(context.candidates.filter((c) => !c.exclusion)).toHaveLength(2);
    expect(context.candidates).toContain(excluded);
    expect(context.candidates.find((c) => c.product.product.id === 'c')?.exclusion?.code).toBe('max_items_exceeded');
  });

  it('converts stock units before comparing with rate times area', async () => {
    const context = contextFor();
    context.candidates = [named('a', 0.8, 100)];
    const millilitres: StockProvider = { getStock: jest.fn().mockResolvedValue([{ productId: 'a', quantity: 20000, inStock: true, unit: 'ml' }]) };
    await new RankStep(settings(), millilitres).run(context);
    expect(context.candidates[0].stock.inStock).toBe(true);
  });

  it('treats stock in an incompatible unit as unavailable', async () => {
    const context = contextFor();
    context.candidates = [named('a', 0.8, 100)];
    const kilograms: StockProvider = { getStock: jest.fn().mockResolvedValue([{ productId: 'a', quantity: 500, inStock: true, unit: 'kg' }]) };
    await new RankStep(settings(), kilograms).run(context);
    expect(context.candidates[0].stock.inStock).toBe(false);
  });

  it('warns when two proposed products are incompatible in a tank mix', async () => {
    const context = contextFor();
    const second = candidate({ registration: registration({ id: 'reg-b', incompatibleWith: ['a'] }), product: productView({ id: 'b', name: 'b' }) });
    context.candidates = [named('a', 0.9, 1), second];
    await new RankStep(settings(), stockOf([])).run(context);
    expect(context.warnings.map((w) => w.code)).toContain('tank_mix_incompatible');
  });
});
