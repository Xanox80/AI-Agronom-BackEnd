import { CatalogReader } from '../catalog.reader';
import { contextFor, productView, registration } from '../__fixtures__/pipeline-fixtures';
import { AllowedProductsStep } from './allowed-products.step';
import { CONSULT_EXPERT_WARNING } from './pipeline-types';

function stepWith(registrations: ReturnType<typeof registration>[], products = new Map([['prod-1', productView()]])) {
  const catalog = { findRegistrations: jest.fn().mockResolvedValue(registrations), loadProducts: jest.fn().mockResolvedValue(products) };
  return { step: new AllowedProductsStep(catalog as unknown as CatalogReader), catalog };
}

describe('AllowedProductsStep', () => {
  it('builds candidates from registrations of the crop and diagnosis with the midpoint rate', async () => {
    const { step, catalog } = stepWith([registration()]);
    const context = contextFor();
    await step.run(context);
    expect(catalog.findRegistrations).toHaveBeenCalledWith('crop-1', 'diag-1');
    expect(context.candidates).toHaveLength(1);
    expect(context.candidates[0].rateValue).toBe(1);
    expect(context.candidates[0].costPerHaUah).toBe(500);
  });

  it('stops and asks for an expert when nothing is registered', async () => {
    const { step } = stepWith([]);
    const context = contextFor();
    await step.run(context);
    expect(context.stopped).toBe(true);
    expect(context.warnings.map((w) => w.code)).toContain(CONSULT_EXPERT_WARNING);
  });

  it('skips registrations whose product is missing from the catalogue', async () => {
    const { step } = stepWith([registration({ productId: 'missing' })]);
    const context = contextFor();
    await step.run(context);
    expect(context.candidates).toHaveLength(0);
    expect(context.stopped).toBe(true);
  });
});
