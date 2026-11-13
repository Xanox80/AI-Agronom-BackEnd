import { similarPhotoReferences } from './similar-photo-references';

const raw = (locale: string) => ({
  locale,
  referenceNeighbours: { examples: [
    { id: 'p1', diagnosisCode: 'rust', score: 0.934, attribution: 'Kaggle (CC0)' },
    { id: 'p2', diagnosisCode: 'mildew', score: 0.9, attribution: 'AP Scout' },
  ] },
});

describe('similarPhotoReferences', () => {
  it('turns the recorded examples of listed hypotheses into reference images with a localized caption', () => {
    expect(similarPhotoReferences(raw('uk'), ['rust'], '/api/v1/similarity/photos')).toEqual([{
      id: 'p1', diagnosisCode: 'rust', url: '/api/v1/similarity/photos/p1', caption: 'Схоже на ваше фото на 93%', attribution: 'Kaggle (CC0)',
    }]);
  });

  it('captions in English for an English diagnosis', () => {
    expect(similarPhotoReferences(raw('en'), ['mildew'], '/x')[0].caption).toBe('90% similar to your photo');
  });

  it('returns nothing for results recorded without examples', () => {
    expect(similarPhotoReferences({ locale: 'uk' }, ['rust'], '/x')).toEqual([]);
    expect(similarPhotoReferences(null, ['rust'], '/x')).toEqual([]);
  });
});
