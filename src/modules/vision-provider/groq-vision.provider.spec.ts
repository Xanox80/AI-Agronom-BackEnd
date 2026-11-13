import { GroqVisionProvider } from './groq-vision.provider';
import { VisionInput } from './vision.types';

const TOP_K = 3;
const CONFIG = {
  provider: 'groq' as const, geminiApiKey: '', geminiModel: 'gemini-model', groqApiKey: 'test-key', groqModel: 'groq-model',
  timeoutMs: 1234, maxRetries: 2, retryBaseDelayMs: 0, retryMaxDelayMs: 1000, temperature: 0.2,
};

const input: VisionInput = {
  photos: [{ bytes: Buffer.from('img'), mimeType: 'image/jpeg' }],
  context: { cropCode: 'wheat_winter' },
  allowedDiagnosisCodes: ['rust'],
  locale: 'uk',
};

const reply = (content: string | null = JSON.stringify({
  crop: 'wheat_winter', organ: 'leaf', problemCategory: 'disease', clarifyingQuestions: [], outOfDistribution: false,
  hypotheses: [{ diagnosisCode: 'rust', probability: 0.8, evidence: 'pustules' }],
})) => ({ choices: [{ message: { content } }] });

const rateLimited = (message: string, retryAfter?: string) =>
  Object.assign(new Error(message), { name: 'RateLimitError', status: 429, headers: new Headers(retryAfter ? { 'retry-after': retryAfter } : {}) });

const providerWith = (create: jest.Mock) => new GroqVisionProvider(CONFIG, { chat: { completions: { create } } }, TOP_K);

describe('GroqVisionProvider', () => {
  it('sends images as data URLs with model, JSON mode and timeout from config', async () => {
    const create = jest.fn().mockResolvedValue(reply());
    const out = await providerWith(create).analyze(input);

    const [body, options] = create.mock.calls[0];
    expect(body.model).toBe('groq-model');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(options.timeout).toBe(1234);
    expect(body.messages[1].content[0].image_url.url).toBe(`data:image/jpeg;base64,${Buffer.from('img').toString('base64')}`);
    expect(out.hypotheses[0].diagnosisCode).toBe('rust');
  });

  it('puts the catalogue-limited JSON schema into the system prompt', async () => {
    const create = jest.fn().mockResolvedValue(reply());
    await providerWith(create).analyze(input);
    const system: string = create.mock.calls[0][0].messages[0].content;
    expect(system).toContain('"enum":["rust","other","unknown"]');
    expect(system).toContain('"type":["string","null"]');
  });

  it('retries once after an empty answer and then succeeds', async () => {
    const create = jest.fn().mockResolvedValueOnce(reply(null)).mockResolvedValueOnce(reply());
    await expect(providerWith(create).analyze(input)).resolves.toBeDefined();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('waits the retry-after delay Groq sends on 429', async () => {
    jest.useFakeTimers();
    try {
      const create = jest.fn().mockRejectedValueOnce(rateLimited('Rate limit reached: tokens per minute', '0.5')).mockResolvedValueOnce(reply());
      const done = providerWith(create).analyze(input);
      await jest.advanceTimersByTimeAsync(499);
      expect(create).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(create).toHaveBeenCalledTimes(2);
      await expect(done).resolves.toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry once the daily quota is spent', async () => {
    const create = jest.fn().mockRejectedValue(rateLimited('Rate limit reached on tokens per day (TPD)', '60'));
    const error = await providerWith(create).analyze(input).catch((e) => e);
    expect(error).toMatchObject({ httpStatus: 429, attempts: 1, retryable: false });
    expect(error.message).toContain('Groq request failed');
  });
});
