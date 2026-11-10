import { Injectable } from '@nestjs/common';
import { ProblemCategory } from '../../domain/enums';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { HeatmapPointDto, HeatmapResponseDto } from './dto/analytics-response.dto';
import { ObservationSelector, ResolvedObservation } from './observation-selector.service';

@Injectable()
export class HeatmapService {
  constructor(private readonly selector: ObservationSelector) {}

  async build(farmId: string, filter: AnalyticsFilterDto): Promise<HeatmapResponseDto> {
    const problems = (await this.selector.select(farmId, filter)).filter(isLocatedProblem);
    const points: HeatmapPointDto[] = problems.map(({ observation, diagnosis }) => ({
      lat: observation.lat as number,
      lng: observation.lng as number,
      weight: diagnosis!.weight,
      diagnosisCode: diagnosis!.code,
      observationId: observation.id,
    }));

    const countByField = new Map<string, number>();
    for (const { observation } of problems) {
      if (observation.fieldId) countByField.set(observation.fieldId, (countByField.get(observation.fieldId) ?? 0) + 1);
    }
    const fields = await this.selector.fieldsById(farmId, [...countByField.keys()]);
    return {
      points,
      fields: [...countByField].flatMap(([fieldId, count]) => {
        const field = fields.get(fieldId);
        return field ? [{ fieldId, name: field.name, count, contour: field.contour ?? undefined }] : [];
      }),
    };
  }
}

function isLocatedProblem({ observation, diagnosis }: ResolvedObservation): boolean {
  return diagnosis !== null && diagnosis.problemCategory !== ProblemCategory.Normal
    && observation.lat !== null && observation.lng !== null;
}
