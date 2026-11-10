import { testConfig } from './__fixtures__/recognition-fixtures';
import { DiagnosisPresenter } from './diagnosis-presenter.service';
import { RecognitionStatus } from './recognition.constants';

describe('DiagnosisPresenter', () => {
  const result = {
    id: 'r1', observationId: 'o1', pass: 'initial', modelVersion: 'm', cropCode: 'wheat', organ: null, problemCategory: null, unsure: true,
    unsureReason: 'low_confidence', outOfDistribution: false, pestSpecies: null, pestStage: null, pestDensityPerPlant: null,
    pestDensityPerM2: null, clarifyingQuestions: [], answers: {}, createdAt: new Date('2026-01-01'),
  };
  const hypothesis = {
    rank: 1, diagnosisId: 'd1', diagnosisCode: 'rust', probability: 0.4, stage: null, evidence: 'e',
    regionX: 0.1, regionY: 0.2, regionW: 0.3, regionH: 0.4, regionPhotoSeq: 2,
  };

  const build = (photoCount: number) => {
    const store = { hypothesesOf: jest.fn().mockResolvedValue([hypothesis]) };
    const catalog = {
      diagnosesByCode: jest.fn().mockResolvedValue(new Map([['rust', { nameUk: 'Іржа', nameEn: 'Rust' }]])),
      referenceImages: jest.fn().mockResolvedValue(new Map([['d1', [{ id: 'img1', caption: 'c', attribution: 'a', stage: null }]]])),
    };
    const photos = { count: jest.fn().mockResolvedValue(photoCount) };
    return new DiagnosisPresenter(store as never, catalog as never, testConfig(), photos as never);
  };

  it('presents an unsure result as needs_expert with references, region and a request for more photos', async () => {
    const dto = await build(1).present(result as never);
    expect(dto).toMatchObject({ status: RecognitionStatus.NeedsExpert, needsMorePhotos: true });
    expect(dto.hypotheses[0]).toMatchObject({ nameUk: 'Іржа', region: { photoSeq: 2, x: 0.1 } });
    expect(dto.referenceImages[0].url).toBe('/api/v1/catalog/reference-images/img1/file');
  });

  it('does not ask for more photos at the maximum', async () => {
    expect((await build(3).present(result as never)).needsMorePhotos).toBe(false);
  });
});
