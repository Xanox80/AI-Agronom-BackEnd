import { readFileSync } from 'fs';

export interface MappedClass {
  diagnosisCode: string;
  cropCode: string;
}

/** Dataset folder label (class name) to catalogue codes; labels absent from `classes` are skipped. */
export interface ClassMapping {
  source: string;
  /** Credit shown under the dataset's photos, e.g. "Kaggle: wheat-plant-diseases (CC0)". */
  attribution?: string;
  classes: Record<string, MappedClass>;
}

export function parseClassMapping(json: string, origin: string): ClassMapping {
  const parsed = JSON.parse(json) as Partial<ClassMapping>;
  if (!parsed.source || typeof parsed.source !== 'string') throw new Error(`${origin}: "source" must be a non-empty string`);
  if (!parsed.classes || typeof parsed.classes !== 'object') throw new Error(`${origin}: "classes" must be an object`);
  Object.entries(parsed.classes).forEach(([label, mapped]) => {
    if (!mapped?.diagnosisCode || !mapped?.cropCode) throw new Error(`${origin}: class "${label}" needs diagnosisCode and cropCode`);
  });
  return { source: parsed.source, attribution: parsed.attribution, classes: parsed.classes };
}

export function readClassMapping(path: string): ClassMapping {
  return parseClassMapping(readFileSync(path, 'utf8'), path);
}
