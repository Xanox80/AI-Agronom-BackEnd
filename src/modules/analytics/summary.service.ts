import { Injectable } from '@nestjs/common';
import { weekStart } from './date-window';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { SummaryResponseDto } from './dto/analytics-response.dto';
import { ObservationSelector } from './observation-selector.service';

@Injectable()
export class SummaryService {
  constructor(private readonly selector: ObservationSelector) {}

  async build(farmId: string, filter: AnalyticsFilterDto): Promise<SummaryResponseDto> {
    const selected = await this.selector.select(farmId, filter);

    const byDiagnosis = new Map<string, { name: string; count: number }>();
    const byField = new Map<string, number>();
    const byWeek = new Map<string, number>();
    for (const { observation, diagnosis } of selected) {
      if (diagnosis) {
        const entry = byDiagnosis.get(diagnosis.code) ?? { name: diagnosis.name, count: 0 };
        byDiagnosis.set(diagnosis.code, { ...entry, count: entry.count + 1 });
      }
      if (observation.fieldId) byField.set(observation.fieldId, (byField.get(observation.fieldId) ?? 0) + 1);
      const week = weekStart(observation.capturedAt);
      byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
    }

    const fields = await this.selector.fieldsById(farmId, [...byField.keys()]);
    return {
      total: selected.length,
      byDiagnosis: [...byDiagnosis].map(([code, { name, count }]) => ({ code, name, count })).sort(byCountDesc),
      byField: [...byField]
        .map(([fieldId, count]) => ({ fieldId, name: fields.get(fieldId)?.name ?? fieldId, count })).sort(byCountDesc),
      byWeek: [...byWeek].map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week)),
    };
  }
}

const byCountDesc = (a: { count: number }, b: { count: number }): number => b.count - a.count;
