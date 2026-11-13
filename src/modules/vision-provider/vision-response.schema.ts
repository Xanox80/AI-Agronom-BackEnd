import { Type } from '@google/genai';
import { Organ, PestStage, ProblemCategory } from '../../domain/enums';
import { OTHER_CODE, UNKNOWN } from './vision.types';

const str = { type: Type.STRING };
const num = { type: Type.NUMBER };
const nullable = <T extends object>(schema: T) => ({ ...schema, nullable: true });
const enumOf = (values: string[]) => ({ type: Type.STRING, enum: values });

/** Gemini responseSchema mirroring section 8 of docs/architecture.md; diagnosisCode is limited to the allowed catalogue. */
export const buildVisionResponseSchema = (allowedCodes: string[]) => ({
  type: Type.OBJECT,
  required: ['crop', 'organ', 'problemCategory', 'hypotheses', 'clarifyingQuestions', 'outOfDistribution'],
  properties: {
    crop: str,
    organ: enumOf([...Object.values(Organ), UNKNOWN]),
    problemCategory: enumOf([...Object.values(ProblemCategory), UNKNOWN]),
    hypotheses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['diagnosisCode', 'probability', 'evidence'],
        properties: {
          diagnosisCode: enumOf([...allowedCodes, OTHER_CODE, UNKNOWN]),
          probability: num,
          stage: nullable(str),
          evidence: str,
          region: nullable({
            type: Type.OBJECT,
            required: ['x', 'y', 'w', 'h', 'photoIndex'],
            properties: { x: num, y: num, w: num, h: num, photoIndex: { type: Type.INTEGER } },
          }),
        },
      },
    },
    pest: nullable({
      type: Type.OBJECT,
      properties: {
        species: nullable(str),
        stage: enumOf(Object.values(PestStage)),
        countVisible: { type: Type.INTEGER },
        densityPerPlant: nullable(num),
        densityPerM2: nullable(num),
      },
    }),
    clarifyingQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['id', 'textUk', 'textEn', 'answerType', 'narrowsDiagnosisCodes'],
        properties: {
          id: str, textUk: str, textEn: str,
          answerType: enumOf(['yes_no', 'choice']),
          options: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { value: str, labelUk: str, labelEn: str } },
          },
          narrowsDiagnosisCodes: { type: Type.ARRAY, items: str },
        },
      },
    },
    outOfDistribution: { type: Type.BOOLEAN },
  },
});

type GeminiSchema = { type: string; nullable?: boolean; properties?: Record<string, GeminiSchema>; items?: GeminiSchema; [key: string]: unknown };

/** Standard JSON Schema form of the same response shape, for OpenAI-compatible models. */
export const buildVisionResponseJsonSchema = (allowedCodes: string[]) => toJsonSchema(buildVisionResponseSchema(allowedCodes));

function toJsonSchema({ type, nullable: isNullable, properties, items, ...rest }: GeminiSchema): object {
  const jsonType = type.toLowerCase();
  return {
    ...rest,
    type: isNullable ? [jsonType, 'null'] : jsonType,
    ...(properties && { properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, toJsonSchema(value)])) }),
    ...(items && { items: toJsonSchema(items) }),
  };
}
