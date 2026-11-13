import { ReferenceImageDto } from '../../domain/types';
import { ReferenceExample } from '../similarity/similarity.types';
import { Locale, SUPPORTED_LOCALES } from './recognition.constants';

const PERCENT = 100;

type RawResponse = Record<string, unknown> | null | undefined;
const SIMILAR_CAPTION: Record<Locale, (percent: number) => string> = {
  uk: (percent) => `Схоже на ваше фото на ${percent}%`,
  en: (percent) => `${percent}% similar to your photo`,
};

/** The comparison photos recorded at diagnosis time (rawResponse.referenceNeighbours.examples), if any. */
function recordedExamples(rawResponse: RawResponse): ReferenceExample[] {
  const neighbours = rawResponse?.referenceNeighbours as { examples?: ReferenceExample[] } | null | undefined;
  return Array.isArray(neighbours?.examples) ? neighbours.examples : [];
}

function localeOf(rawResponse: RawResponse): Locale {
  const locale = rawResponse?.locale as Locale;
  return SUPPORTED_LOCALES.includes(locale) ? locale : 'uk';
}

/** Labelled photos most similar to the scout's photos, as reference images of the hypotheses they match. */
export function similarPhotoReferences(rawResponse: RawResponse, hypothesisCodes: string[], urlBase: string): ReferenceImageDto[] {
  const caption = SIMILAR_CAPTION[localeOf(rawResponse)];
  const codes = new Set(hypothesisCodes);
  return recordedExamples(rawResponse)
    .filter((example) => codes.has(example.diagnosisCode))
    .map((example) => ({
      id: example.id, diagnosisCode: example.diagnosisCode, url: `${urlBase}/${example.id}`,
      caption: caption(Math.round(example.score * PERCENT)), attribution: example.attribution,
    }));
}
