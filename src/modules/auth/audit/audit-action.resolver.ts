import { Injectable } from '@nestjs/common';
import { AuthSettings } from '../auth.settings';

const VERB_BY_METHOD: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
const PARAM_SEGMENT = /^[:*]/;

export interface ResolvedAction { action: string; entityType: string }

/** Derives `observation.create` / `recommendation.approve` style names from the matched route pattern. */
@Injectable()
export class AuditActionResolver {
  constructor(private readonly settings: AuthSettings) {}

  resolve(method: string, routePath: string): ResolvedAction {
    const [resource = 'unknown', ...rest] = this.segments(routePath);
    const entityType = singular(resource);
    const suffix = rest.length ? rest.join('.') : (VERB_BY_METHOD[method] ?? method.toLowerCase());
    return { action: `${entityType}.${suffix}`, entityType };
  }

  private segments(routePath: string): string[] {
    const prefix = this.settings.apiPrefix.split('/').filter(Boolean);
    const parts = routePath.split('/').filter(Boolean);
    const withoutPrefix = prefix.every((p, i) => parts[i] === p) ? parts.slice(prefix.length) : parts;
    return withoutPrefix.filter((part) => !PARAM_SEGMENT.test(part));
  }
}

function singular(word: string): string {
  return word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}
