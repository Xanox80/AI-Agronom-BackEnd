import { GbifPage, occurrenceSearchUrl, openLicense, openPhotos, smallerCopy } from './gbif-photo-source';

describe('gbif-photo-source', () => {
  it('accepts CC0 and CC BY and rejects non-commercial or no-derivatives licences', () => {
    expect(openLicense('http://creativecommons.org/publicdomain/zero/1.0/')).toBe('CC0');
    expect(openLicense('http://creativecommons.org/licenses/by/4.0/')).toBe('CC BY');
    expect(openLicense('http://creativecommons.org/licenses/by-nc/4.0/')).toBeUndefined();
    expect(openLicense('http://creativecommons.org/licenses/by-nd/4.0/')).toBeUndefined();
    expect(openLicense(undefined)).toBeUndefined();
  });

  it('asks GBIF for still images of one taxon in one dataset, page by page', () => {
    const url = new URL(occurrenceSearchUrl({ taxonKey: 1048319, datasetKey: 'inat', offset: 300, limit: 300 }));
    expect(Object.fromEntries(url.searchParams)).toEqual({ taxonKey: '1048319', datasetKey: 'inat', mediaType: 'StillImage', limit: '300', offset: '300' });
  });

  it('points iNaturalist originals at a smaller copy', () => {
    expect(smallerCopy('https://inaturalist-open-data.s3.amazonaws.com/photos/1/original.jpeg', 'medium'))
      .toBe('https://inaturalist-open-data.s3.amazonaws.com/photos/1/medium.jpeg');
  });

  it('keeps only openly licensed images, named by occurrence and credited', () => {
    const page: GbifPage = {
      endOfRecords: true,
      results: [{
        key: 7,
        media: [
          { type: 'StillImage', identifier: 'https://x/photos/1/original.jpg', license: 'http://creativecommons.org/licenses/by/4.0/', rightsHolder: 'Ann', references: 'https://inat/1' },
          { type: 'StillImage', identifier: 'https://x/photos/2/original.jpg', license: 'http://creativecommons.org/licenses/by-nc/4.0/' },
          { type: 'Sound', identifier: 'https://x/a.wav', license: 'http://creativecommons.org/publicdomain/zero/1.0/' },
        ],
      }],
    };
    expect(openPhotos(page, 'medium')).toEqual([
      { url: 'https://x/photos/1/medium.jpg', fileName: '7-0.jpg', license: 'CC BY', credit: 'Ann', sourcePage: 'https://inat/1' },
    ]);
  });
});
