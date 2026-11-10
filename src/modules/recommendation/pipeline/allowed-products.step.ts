import { Injectable } from '@nestjs/common';
import { CatalogReader } from '../catalog.reader';
import { CONSULT_EXPERT_WARNING, Candidate, PipelineContext, PipelineStep, warn } from './pipeline-types';

/** Step 2 (FR-14): products registered for the crop and diagnosis pair; nothing outside the registry is ever proposed. */
@Injectable()
export class AllowedProductsStep implements PipelineStep {
  constructor(private readonly catalog: CatalogReader) {}

  async run(context: PipelineContext): Promise<void> {
    const { crop, diagnosis } = context.input;
    const registrations = await this.catalog.findRegistrations(crop.id, diagnosis.id);
    const products = await this.catalog.loadProducts([...new Set(registrations.map((r) => r.productId))]);
    context.candidates = registrations.flatMap((registration): Candidate[] => {
      const product = products.get(registration.productId);
      if (!product) return [];
      return [{
        registration, product, rateValue: (registration.rateMin + registration.rateMax) / 2, exclusion: null,
        rotationOk: true, rotationNote: null, stock: { inStock: false, quantity: null, unit: null },
        costPerHaUah: product.product.pricePerHaUah, score: 0,
      }];
    });
    if (context.candidates.length === 0) {
      warn(context, CONSULT_EXPERT_WARNING, 'warning', { cause: 'no_registered_products' });
      context.stopped = true;
    }
  }
}
