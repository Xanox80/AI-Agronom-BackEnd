import { VisionContext, VisionInput } from './vision.types';

export const buildSystemInstruction = (maxHypotheses: number): string => [
  'You are a plant pathology and entomology assistant for crop scouting.',
  `Classify the problem visible on the photos, rank at most ${maxHypotheses} hypotheses with probabilities that sum to at most 1,`,
  'and give a short visual evidence text for each. Optionally localise each hypothesis with a normalised region (0..1) on a photo.',
  'Use only diagnosisCode values from the allowed list, or "other" if none fits.',
  'Set outOfDistribution to true when the photo is not a crop, is unreadable, or matches no allowed class.',
  'Fill "pest" only when the organ is pest or the category is pest.',
  'If the top hypotheses are close, ask 1-3 short clarifying questions that would separate them.',
  'For a choice question, make each option value a diagnosisCode from the narrowed list (or "other"). Never repeat a question the scout already answered.',
  'NEVER recommend products, active substances, doses or treatments. You only classify and explain.',
].join(' ');

const CONTEXT_LABELS: [keyof VisionContext, string][] = [
  ['cropCode', 'Crop'], ['organHint', 'Organ or object'], ['bbch', 'BBCH stage'], ['temperatureC', 'Air temperature, C'],
  ['humidityPct', 'Relative humidity, %'], ['variety', 'Variety or hybrid'],
];

/** Text part of the request; answers to earlier questions are included as facts to respect. */
export function buildUserPrompt(input: VisionInput): string {
  const { context, allowedDiagnosisCodes, locale, photos } = input;
  const lines = [`Photos attached: ${photos.length} (index from 0).`];
  for (const [key, label] of CONTEXT_LABELS) {
    if (context[key] !== undefined) lines.push(`${label}: ${context[key]}`);
  }
  if (context.fieldHistory?.length) lines.push(`Field disease history: ${context.fieldHistory.join(', ')}`);
  if (context.answers && Object.keys(context.answers).length) {
    lines.push('Scout answers to earlier clarifying questions (treat as facts):');
    for (const [id, answer] of Object.entries(context.answers)) lines.push(`- ${id}: ${answer}`);
  }
  lines.push(`Allowed diagnosisCode values: ${allowedDiagnosisCodes.join(', ')}`);
  lines.push(`Write evidence in ${locale === 'uk' ? 'Ukrainian' : 'English'}; provide both textUk and textEn for questions.`);
  return lines.join('\n');
}
