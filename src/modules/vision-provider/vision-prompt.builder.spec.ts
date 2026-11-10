import { buildSystemInstruction, buildUserPrompt } from './vision-prompt.builder';
import { VisionInput } from './vision.types';

const input = (overrides: Partial<VisionInput> = {}): VisionInput => ({
  photos: [{ bytes: Buffer.from('a'), mimeType: 'image/jpeg' }],
  context: { cropCode: 'wheat_winter', bbch: 32, temperatureC: 18, humidityPct: 80, variety: 'Bogdana', fieldHistory: ['rust'] },
  allowedDiagnosisCodes: ['septoria', 'rust'],
  locale: 'uk',
  ...overrides,
});

describe('buildUserPrompt', () => {
  it('includes crop context, history and the allowed code list', () => {
    const prompt = buildUserPrompt(input());
    expect(prompt).toContain('Crop: wheat_winter');
    expect(prompt).toContain('BBCH stage: 32');
    expect(prompt).toContain('Field disease history: rust');
    expect(prompt).toContain('Allowed diagnosisCode values: septoria, rust');
  });

  it('includes earlier answers as facts', () => {
    const prompt = buildUserPrompt(input({ context: { answers: { q1: 'yes' } } }));
    expect(prompt).toContain('- q1: yes');
  });

  it('asks for evidence in the request locale', () => {
    expect(buildUserPrompt(input())).toContain('Ukrainian');
    expect(buildUserPrompt(input({ locale: 'en' }))).toContain('English');
  });

  it('forbids recommending products or doses in the system instruction', () => {
    expect(buildSystemInstruction(3)).toMatch(/NEVER recommend products/);
  });

  it('takes the hypothesis limit from the argument', () => {
    expect(buildSystemInstruction(5)).toContain('at most 5 hypotheses');
  });
});
