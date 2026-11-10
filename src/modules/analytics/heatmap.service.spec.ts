import { ObservationEntity } from '../../domain/entities';
import { ProblemCategory } from '../../domain/enums';
import { HeatmapService } from './heatmap.service';
import { ObservationSelector, ResolvedObservation } from './observation-selector.service';

const observation = (id: string, patch: Partial<ObservationEntity> = {}): ObservationEntity =>
  ({ id, lat: 50, lng: 30, fieldId: 'f1', ...patch }) as ObservationEntity;
const diagnosis = (category: ProblemCategory | null, weight = 0.8) =>
  ({ id: 'd1', code: 'rust', name: 'Rust', weight, problemCategory: category });

describe('HeatmapService', () => {
  const build = (selected: ResolvedObservation[]) => {
    const selector = {
      select: jest.fn().mockResolvedValue(selected),
      fieldsById: jest.fn().mockResolvedValue(new Map([['f1', { name: 'North', contour: { type: 'Point', coordinates: [0, 0] } }]])),
    } as unknown as ObservationSelector;
    return new HeatmapService(selector).build('farm', {});
  };

  it('weights points by the diagnosis and counts them per field', async () => {
    const result = await build([
      { observation: observation('o1'), diagnosis: diagnosis(ProblemCategory.Disease, 1) },
      { observation: observation('o2'), diagnosis: diagnosis(ProblemCategory.Disease, 0.6) },
    ]);
    expect(result.points).toEqual([
      { lat: 50, lng: 30, weight: 1, diagnosisCode: 'rust', observationId: 'o1' },
      { lat: 50, lng: 30, weight: 0.6, diagnosisCode: 'rust', observationId: 'o2' },
    ]);
    expect(result.fields).toEqual([{ fieldId: 'f1', name: 'North', count: 2, contour: { type: 'Point', coordinates: [0, 0] } }]);
  });

  it('skips healthy, undiagnosed and unlocated observations', async () => {
    const result = await build([
      { observation: observation('o1'), diagnosis: diagnosis(ProblemCategory.Normal) },
      { observation: observation('o2'), diagnosis: null },
      { observation: observation('o3', { lat: null }), diagnosis: diagnosis(ProblemCategory.Pest) },
    ]);
    expect(result).toEqual({ points: [], fields: [] });
  });
});
