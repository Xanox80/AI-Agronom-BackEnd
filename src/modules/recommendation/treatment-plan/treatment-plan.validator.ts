import { DraftApplication, DraftPlan, PlanProduct, TreatmentFacts } from './treatment-plan.types';

export interface ValidatedPlan {
  plan: DraftPlan | null;
  errors: string[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);

function toDraft(raw: unknown): DraftPlan | null {
  const body = raw as Partial<Record<keyof DraftPlan, unknown>> | null;
  if (!body || typeof body !== 'object' || !Array.isArray(body.applications)) return null;
  return {
    summary: text(body.summary),
    monitoring: text(body.monitoring),
    precautions: Array.isArray(body.precautions) ? body.precautions.map(text).filter(Boolean) : [],
    applications: body.applications.map((a: Record<string, unknown>) => ({
      productId: text(a?.productId), rateValue: finite(a?.rateValue), waterLPerHa: finite(a?.waterLPerHa),
      dayOffset: finite(a?.dayOffset), timing: text(a?.timing), note: text(a?.note),
    })),
  };
}

function applicationErrors(a: DraftApplication, n: number, product: PlanProduct | undefined, facts: TreatmentFacts): string[] {
  if (!product) return [`application ${n}: product ${a.productId || '(none)'} is not among the allowed products`];
  const errors: string[] = [];
  if (!(a.rateValue >= product.rateMin && a.rateValue <= product.rateMax)) {
    errors.push(`application ${n}: rate ${a.rateValue} ${product.rateUnit} is outside the registered ${product.rateMin}-${product.rateMax}`);
  }
  if (!(a.waterLPerHa >= facts.waterLPerHa.min && a.waterLPerHa <= facts.waterLPerHa.max)) {
    errors.push(`application ${n}: water ${a.waterLPerHa} l/ha is outside ${facts.waterLPerHa.min}-${facts.waterLPerHa.max}`);
  }
  if (!(a.dayOffset >= 0)) errors.push(`application ${n}: day offset must be 0 or more`);
  return errors;
}

/** Per product: no more sprayings than registered, and never closer together than the registered interval. */
function courseErrors(applications: DraftApplication[], products: Map<string, PlanProduct>): string[] {
  const errors: string[] = [];
  products.forEach((product, productId) => {
    const days = applications.filter((a) => a.productId === productId).map((a) => a.dayOffset).sort((x, y) => x - y);
    if (days.length > product.maxApplications) {
      errors.push(`${product.name}: ${days.length} applications, registered maximum is ${product.maxApplications}`);
    }
    days.slice(1).forEach((day, i) => {
      if (day - days[i] < product.minIntervalDays) {
        errors.push(`${product.name}: ${day - days[i]} days between applications, registered minimum is ${product.minIntervalDays}`);
      }
    });
  });
  return errors;
}

/**
 * Checks the model's answer against the registry facts it was given. Any broken limit rejects the whole plan:
 * a half-trusted treatment plan is worse than none, and the rules-engine products stay on screen anyway.
 */
export function validateTreatmentPlan(raw: unknown, facts: TreatmentFacts): ValidatedPlan {
  const draft = toDraft(raw);
  if (!draft) return { plan: null, errors: ['answer is not a plan object with an applications list'] };
  if (!draft.applications.length) return { plan: null, errors: ['plan has no applications'] };
  const products = new Map(facts.products.map((p) => [p.productId, p]));
  const errors = [
    ...draft.applications.flatMap((a, i) => applicationErrors(a, i + 1, products.get(a.productId), facts)),
    ...courseErrors(draft.applications, products),
  ];
  if (!draft.summary) errors.push('plan has no summary');
  return errors.length ? { plan: null, errors } : { plan: draft, errors: [] };
}
