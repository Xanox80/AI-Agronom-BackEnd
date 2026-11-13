import { GroqTreatmentWriter, TreatmentWriterError } from './groq-treatment-writer';
import { buildTreatmentPlanSettings } from './treatment-plan.settings';
import { TreatmentFacts } from './treatment-plan.types';

describe('GroqTreatmentWriter', () => {
  const settings = buildTreatmentPlanSettings('key', { TREATMENT_PLAN_MODEL: 'test-model' });
  const facts = { cropNameUk: 'Пшениця', products: [] } as unknown as TreatmentFacts;
  const clientAnswering = (content: string | null) => ({ chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }) } } });

  it('asks the configured model for JSON with the facts and returns the parsed answer', async () => {
    const client = clientAnswering('{"summary":"ok","applications":[]}');
    const answer = await new GroqTreatmentWriter(settings, client).write(facts);
    expect(answer).toEqual({ summary: 'ok', applications: [] });
    const [body, options] = client.chat.completions.create.mock.calls[0];
    expect(body).toMatchObject({ model: 'test-model', response_format: { type: 'json_object' } });
    expect(body.messages[1].content).toContain('Пшениця');
    expect(options).toEqual({ timeout: 45000 });
  });

  it('reports empty, broken and failed answers as writer errors', async () => {
    await expect(new GroqTreatmentWriter(settings, clientAnswering(null)).write(facts)).rejects.toThrow(TreatmentWriterError);
    await expect(new GroqTreatmentWriter(settings, clientAnswering('not json')).write(facts)).rejects.toThrow('not valid JSON');
    const failing = { chat: { completions: { create: jest.fn().mockRejectedValue(new Error('429 rate limit')) } } };
    await expect(new GroqTreatmentWriter(settings, failing).write(facts)).rejects.toThrow('429 rate limit');
  });
});
