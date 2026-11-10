import { Injectable } from '@nestjs/common';
import { WeatherVerdict } from '../../../domain/enums';
import type { RecommendationSource } from '../../../domain/types';
import { DEFAULT_EXPLANATION_LOCALE, EXPLANATION_MESSAGES, ExplanationLocale } from './explanation.messages';
import { Candidate, PipelineContext, Reason } from './pipeline-types';

const PERCENT = 100;

/** Step 6: deterministic human-readable "why"; no model writes it, so doses and products cannot drift. */
@Injectable()
export class ExplanationBuilder {
  build(context: PipelineContext, sources: RecommendationSource[], localeCode: string): string {
    const messages = EXPLANATION_MESSAGES[localeCode as ExplanationLocale] ?? EXPLANATION_MESSAGES[DEFAULT_EXPLANATION_LOCALE];
    const text = (key: string, params: Record<string, unknown> = {}) => this.format(messages[key] ?? key, params);
    const reason = (prefix: string, r: Reason) => text(`${prefix}.${r.code}`, r.params);
    const { input } = context;
    const { diagnosis } = input;
    const lines = [
      text('diagnosis', {
        name: localeCode === 'en' ? diagnosis.nameEn : diagnosis.nameUk,
        probability: Math.round(diagnosis.probability * PERCENT),
        confirmed: diagnosis.confirmed ? text('confirmedSuffix') : '',
      }),
      text(`action.${context.actionLevel}`),
      reason('reason', context.actionReason),
    ];
    const chosen = context.candidates.filter((c) => !c.exclusion);
    if (chosen.length > 0) {
      lines.push(text('items'), ...chosen.map((c, index) => this.itemLine(c, index + 1, text)));
    }
    lines.push(...context.candidates.filter((c) => c.exclusion).map((c) =>
      text('excludedItem', { name: c.product.product.name, reason: reason('excluded', c.exclusion as Reason) })));
    lines.push(...this.weatherLines(context, text));
    lines.push(...context.warnings.map((w) => text(`warning.${w.code}`, w.params)));
    if (sources.length > 0) lines.push(text('sources', { sources: sources.map((s) => s.ref).join('; ') }));
    lines.push(input.catalog.verifiedAt ? text('catalogDate', { date: input.catalog.verifiedAt }) : text('catalogUnverified'));
    if (input.catalog.stale) lines.push(text('catalogStale'));
    lines.push(text('draft'));
    return lines.join('\n');
  }

  private itemLine(c: Candidate, rank: number, text: (key: string, params?: Record<string, unknown>) => string): string {
    return text('item', {
      rank, name: c.product.product.name, rate: c.rateValue, unit: c.registration.rateUnit,
      phi: c.registration.preHarvestIntervalDays, substances: c.product.substances.map((s) => s.code).join(', '),
    });
  }

  private weatherLines(context: PipelineContext, text: (key: string, params?: Record<string, unknown>) => string): string[] {
    const { weather } = context;
    if (!weather) return [];
    const lines = [text(`weather.${weather.verdict}`)];
    if (weather.verdict !== WeatherVerdict.Go && weather.nextGoAt) lines.push(text('weather.next', { nextGoAt: weather.nextGoAt }));
    return lines;
  }

  private format(template: string, params: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
  }
}
