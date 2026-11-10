import { MockVisionProvider } from './mock-vision.provider';
import { VisionInput } from './vision.types';

const input = (bytes = 'a', overrides: Partial<VisionInput> = {}): VisionInput => ({
  photos: [{ bytes: Buffer.from(bytes), mimeType: 'image/jpeg' }],
  context: { cropCode: 'maize' },
  allowedDiagnosisCodes: ['a', 'b', 'c', 'd'],
  locale: 'uk',
  ...overrides,
});

describe('MockVisionProvider', () => {
  const provider = new MockVisionProvider(3);

  it('is deterministic for the same photos', async () => {
    expect(await provider.analyze(input())).toEqual(await provider.analyze(input()));
  });

  it('returns up to three catalogue codes with descending probabilities', async () => {
    const out = await provider.analyze(input());
    expect(out.hypotheses).toHaveLength(3);
    expect(out.hypotheses.every((h) => ['a', 'b', 'c', 'd'].includes(h.diagnosisCode))).toBe(true);
    expect(out.hypotheses[0].probability).toBeGreaterThan(out.hypotheses[1].probability);
    expect(out.crop).toBe('maize');
  });

  it('asks a clarifying question only when no answers were given', async () => {
    expect((await provider.analyze(input())).clarifyingQuestions).toHaveLength(1);
    const answered = await provider.analyze(input('a', { context: { answers: { mock_spread_pattern: 'yes' } } }));
    expect(answered.clarifyingQuestions).toHaveLength(0);
  });

  it('writes evidence in the request locale', async () => {
    expect((await provider.analyze(input('a', { locale: 'en' }))).hypotheses[0].evidence).toContain('Demonstration');
    expect((await provider.analyze(input())).hypotheses[0].evidence).toContain('Демонстраційне');
  });

  it('reports out of distribution when the catalogue is empty', async () => {
    const out = await provider.analyze(input('a', { allowedDiagnosisCodes: [] }));
    expect(out.outOfDistribution).toBe(true);
    expect(out.hypotheses).toEqual([]);
  });
});
