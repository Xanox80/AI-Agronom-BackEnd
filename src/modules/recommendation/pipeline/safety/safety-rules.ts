import { PollinatorHazard } from '../../../../domain/enums';
import type { SafetyWarning } from '../../../../domain/types';
import { ProductEntity } from '../../../../domain/entities';
import { Candidate, FieldInput, PipelineInput } from '../pipeline-types';

/** FR-18: one restriction check that yields zero or more warnings for a candidate product. */
export interface SafetyRule {
  evaluate(candidate: Candidate, input: PipelineInput): SafetyWarning[];
}

type Buffers = PipelineInput['safetyBuffers'];

interface ZoneDescriptor {
  code: string;
  fieldFlag: (field: FieldInput) => boolean;
  productZoneM: (product: ProductEntity) => number;
  defaultZoneM: (buffers: Buffers) => number;
  severity: (product: ProductEntity) => SafetyWarning['severity'];
}

const WARNING: () => SafetyWarning['severity'] = () => 'warning';

/** Buffer zone near water, apiaries or settlements; the product label zone wins over the farm default. */
export class ZoneBufferRule implements SafetyRule {
  constructor(private readonly zone: ZoneDescriptor) {}

  evaluate({ product }: Candidate, { field, safetyBuffers }: PipelineInput): SafetyWarning[] {
    if (!field || !this.zone.fieldFlag(field)) return [];
    const zoneM = this.zone.productZoneM(product.product) || this.zone.defaultZoneM(safetyBuffers);
    return [{
      code: this.zone.code, severity: this.zone.severity(product.product),
      params: { productId: product.product.id, productName: product.product.name, zoneM },
    }];
  }
}

export const waterBufferRule = () => new ZoneBufferRule({
  code: 'water_buffer', fieldFlag: (f) => f.nearWater, productZoneM: (p) => p.waterProtectionZoneM,
  defaultZoneM: (b) => b.waterM, severity: WARNING,
});

export const apiaryBufferRule = () => new ZoneBufferRule({
  code: 'apiary_buffer', fieldFlag: (f) => f.nearApiary, productZoneM: (p) => p.apiaryZoneM,
  defaultZoneM: (b) => b.apiaryM, severity: (p) => (p.pollinatorHazard === PollinatorHazard.High ? 'critical' : 'warning'),
});

export const settlementBufferRule = () => new ZoneBufferRule({
  code: 'settlement_buffer', fieldFlag: (f) => f.nearSettlement, productZoneM: (p) => p.settlementZoneM,
  defaultZoneM: (b) => b.settlementM, severity: WARNING,
});

const POLLINATOR_SEVERITY: Record<PollinatorHazard, SafetyWarning['severity'] | null> = {
  [PollinatorHazard.High]: 'critical',
  [PollinatorHazard.Moderate]: 'warning',
  [PollinatorHazard.Unknown]: 'warning',
  [PollinatorHazard.Low]: null,
};

export class PollinatorRule implements SafetyRule {
  evaluate({ product }: Candidate): SafetyWarning[] {
    const severity = POLLINATOR_SEVERITY[product.product.pollinatorHazard];
    return severity
      ? [{ code: 'pollinator_hazard', severity, params: { productId: product.product.id, productName: product.product.name, hazard: product.product.pollinatorHazard } }]
      : [];
  }
}
