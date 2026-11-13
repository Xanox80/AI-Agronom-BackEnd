export interface GbifMedia {
  type?: string;
  identifier?: string;
  license?: string;
  creator?: string;
  rightsHolder?: string;
  references?: string;
}

export interface GbifOccurrence {
  key: number;
  media?: GbifMedia[];
}

export interface GbifPage {
  results: GbifOccurrence[];
  endOfRecords: boolean;
}

/** A photo that may be stored and used commercially, with the credit its licence requires. */
export interface GbifPhoto {
  url: string;
  fileName: string;
  license: string;
  credit: string;
  sourcePage: string;
}

export interface GbifQuery {
  taxonKey: number;
  /** GBIF dataset to restrict to, e.g. iNaturalist research-grade observations. */
  datasetKey: string;
  offset: number;
  limit: number;
}

const OPEN_LICENSES: Array<[RegExp, string]> = [
  [/publicdomain\/zero|cc0|cc_0/i, 'CC0'],
  [/licenses\/by\/|cc_by_4_0|^cc-by(-4\.0)?$/i, 'CC BY'],
];

/** CC0 and CC BY only: NC and ND photos cannot go into a commercial training set. */
export function openLicense(license: string | undefined): string | undefined {
  if (!license) return undefined;
  return OPEN_LICENSES.find(([pattern]) => pattern.test(license))?.[1];
}

export function occurrenceSearchUrl(query: GbifQuery): string {
  const params = new URLSearchParams({
    taxonKey: String(query.taxonKey), datasetKey: query.datasetKey, mediaType: 'StillImage',
    limit: String(query.limit), offset: String(query.offset),
  });
  return `https://api.gbif.org/v1/occurrence/search?${params}`;
}

/** iNaturalist serves several sizes; the model sees 224 px, so the 500 px copy is plenty and 10x smaller. */
export function smallerCopy(url: string, size: string): string {
  return url.replace(/\/original\.(jpe?g|png)/i, `/${size}.$1`);
}

/** Openly licensed still images of a results page, named by occurrence so re-runs skip what is already saved. */
export function openPhotos(page: GbifPage, size: string): GbifPhoto[] {
  return page.results.flatMap((occurrence) => (occurrence.media ?? [])
    .filter((media) => media.type === 'StillImage' && media.identifier && openLicense(media.license))
    .map((media, i) => ({
      url: smallerCopy(media.identifier!, size),
      fileName: `${occurrence.key}-${i}.jpg`,
      license: openLicense(media.license)!,
      credit: media.rightsHolder ?? media.creator ?? 'unknown',
      sourcePage: media.references ?? `https://www.gbif.org/occurrence/${occurrence.key}`,
    })));
}
