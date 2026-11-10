import { InvalidVisionResponseError, parseVisionResponse } from './vision-response.parser';

const CODES = ['septoria', 'rust'];
const TOP_K = 3;

const valid = () => ({
  crop: 'wheat_winter',
  organ: 'leaf',
  problemCategory: 'disease',
  hypotheses: [
    { diagnosisCode: 'rust', probability: 0.2, stage: null, evidence: 'b', region: null },
    { diagnosisCode: 'septoria', probability: 0.7, stage: 'early', evidence: 'a', region: { x: 0.1, y: 0.2, w: 0.3, h: 0.3, photoIndex: 0 } },
  ],
  pest: null,
  clarifyingQuestions: [],
  outOfDistribution: false,
});

describe('parseVisionResponse', () => {
  it('sorts hypotheses by probability and keeps the region', () => {
    const out = parseVisionResponse(valid(), CODES, 1, TOP_K);
    expect(out.hypotheses.map((h) => h.diagnosisCode)).toEqual(['septoria', 'rust']);
    expect(out.hypotheses[0].region).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.3, photoIndex: 0 });
  });

  it('ranks a diagnosis code outside the catalogue as unknown', () => {
    const raw = valid();
    raw.hypotheses[0].diagnosisCode = 'made_up';
    expect(parseVisionResponse(raw, CODES, 1, TOP_K).hypotheses.map((h) => h.diagnosisCode)).toContain('unknown');
  });

  it('maps the "other" code to unknown', () => {
    const raw = valid();
    raw.hypotheses[0].diagnosisCode = 'other';
    expect(parseVisionResponse(raw, CODES, 1, TOP_K).hypotheses.map((h) => h.diagnosisCode)).toContain('unknown');
  });

  it('keeps raw probabilities untouched even when they sum above one', () => {
    const raw = valid();
    raw.hypotheses[0].probability = 0.9;
    expect(parseVisionResponse(raw, CODES, 1, TOP_K).hypotheses.map((h) => h.probability)).toEqual([0.9, 0.7]);
  });

  it('keeps at most the configured number of hypotheses', () => {
    const raw = valid();
    raw.hypotheses = Array.from({ length: 5 }, () => ({ diagnosisCode: 'rust', probability: 0.1, stage: null, evidence: '', region: null }));
    expect(parseVisionResponse(raw, CODES, 1, TOP_K).hypotheses).toHaveLength(TOP_K);
  });

  it('drops a region that falls outside the photo or points to a missing photo', () => {
    const raw = valid();
    raw.hypotheses[1].region = { x: 0.8, y: 0.2, w: 0.5, h: 0.3, photoIndex: 0 };
    raw.hypotheses[0].region = { x: 0.1, y: 0.1, w: 0.2, h: 0.2, photoIndex: 2 };
    const out = parseVisionResponse(raw, CODES, 1, TOP_K);
    expect(out.hypotheses.every((h) => h.region === null)).toBe(true);
  });

  it('rejects an out-of-range probability', () => {
    const raw = valid();
    raw.hypotheses[0].probability = 1.5;
    expect(() => parseVisionResponse(raw, CODES, 1, TOP_K)).toThrow(InvalidVisionResponseError);
  });

  it('rejects an unknown organ value', () => {
    expect(() => parseVisionResponse({ ...valid(), organ: 'petal' }, CODES, 1, TOP_K)).toThrow(InvalidVisionResponseError);
  });

  it('parses pest data and defaults the stage to unknown', () => {
    const out = parseVisionResponse({ ...valid(), problemCategory: 'pest', pest: { species: 'aphid', countVisible: 12, densityPerPlant: 4 } }, CODES, 1, TOP_K);
    expect(out.pest).toEqual({ species: 'aphid', stage: 'unknown', countVisible: 12, densityPerPlant: 4, densityPerM2: null });
  });

  it('drops pest data unless the organ or the category is pest', () => {
    const pest = { species: 'aphid', countVisible: 1 };
    expect(parseVisionResponse({ ...valid(), pest }, CODES, 1, TOP_K).pest).toBeNull();
    expect(parseVisionResponse({ ...valid(), organ: 'pest', pest }, CODES, 1, TOP_K).pest).not.toBeNull();
  });

  it('parses clarifying questions and requires an id', () => {
    const question = { id: 'q1', textUk: 'так?', textEn: 'yes?', answerType: 'yes_no', narrowsDiagnosisCodes: ['rust'] };
    expect(parseVisionResponse({ ...valid(), clarifyingQuestions: [question] }, CODES, 1, TOP_K).clarifyingQuestions[0].id).toBe('q1');
    expect(() => parseVisionResponse({ ...valid(), clarifyingQuestions: [{ ...question, id: '' }] }, CODES, 1, TOP_K)).toThrow(InvalidVisionResponseError);
  });

  it('rejects a non-object response', () => {
    expect(() => parseVisionResponse('nope', CODES, 1, TOP_K)).toThrow(InvalidVisionResponseError);
  });
});
