import { CropEntity, CatalogDiagnosisEntity } from '../../domain/entities';
import { toDiagnosisDto } from './catalog.mapper';

describe('catalog mapper', () => {
  it('maps a diagnosis with crop ids and provenance', () => {
    const diagnosis = Object.assign(new CatalogDiagnosisEntity(), {
      id: 'd', code: 'rust', crops: [Object.assign(new CropEntity(), { id: 'c1' })], source: 's', verifiedAt: '2026-01-01', isDemo: true,
    });
    expect(toDiagnosisDto(diagnosis)).toMatchObject({ id: 'd', cropIds: ['c1'], source: 's', verifiedAt: '2026-01-01', isDemo: true });
  });

  it('tolerates a diagnosis loaded without crops', () => {
    expect(toDiagnosisDto(new CatalogDiagnosisEntity()).cropIds).toEqual([]);
  });
});
