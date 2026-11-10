import { GeminiVisionProvider } from './gemini-vision.provider';
import { VisionProviderError } from './vision-provider.error';
import { VisionInput } from './vision.types';

const TOP_K = 3;
const CONFIG = { provider: 'gemini' as const, geminiApiKey: 'test-key', geminiModel: 'test-model', geminiTimeoutMs: 1234, geminiMaxRetries: 2, temperature: 0.2 };

const input: VisionInput = {
  photos: [{ bytes: Buffer.from('img'), mimeType: 'image/jpeg' }],
  context: { cropCode: 'wheat_winter' },
  allowedDiagnosisCodes: ['rust'],
  locale: 'uk',
};

const reply = (overrides: object = {}) => ({
  text: JSON.stringify({
    crop: 'wheat_winter', organ: 'leaf', problemCategory: 'disease', clarifyingQuestions: [], outOfDistribution: false,
    hypotheses: [{ diagnosisCode: 'rust', probability: 0.8, evidence: 'pustules' }], ...overrides,
  }),
});

const providerWith = (generateContent: jest.Mock) => new GeminiVisionProvider(CONFIG, { models: { generateContent } }, TOP_K);

describe('GeminiVisionProvider', () => {
  it('sends images, schema, model and timeout from config and returns the parsed output', async () => {
    const generateContent = jest.fn().mockResolvedValue(reply());
    const out = await providerWith(generateContent).analyze(input);

    const params = generateContent.mock.calls[0][0];
    expect(params.model).toBe('test-model');
    expect(params.config.responseMimeType).toBe('application/json');
    expect(params.config.responseSchema).toBeDefined();
    expect(params.config.httpOptions.timeout).toBe(1234);
    expect(params.contents[0].parts[0].inlineData.data).toBe(Buffer.from('img').toString('base64'));
    expect(out.hypotheses[0].diagnosisCode).toBe('rust');
  });

  it('retries after an invalid response and then succeeds', async () => {
    const generateContent = jest.fn().mockResolvedValueOnce({ text: 'not json' }).mockResolvedValueOnce(reply());
    await expect(providerWith(generateContent).analyze(input)).resolves.toBeDefined();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('limits the response schema to the allowed catalogue codes', async () => {
    const generateContent = jest.fn().mockResolvedValue(reply());
    await providerWith(generateContent).analyze(input);
    const schema = generateContent.mock.calls[0][0].config.responseSchema;
    expect(schema.properties.hypotheses.items.properties.diagnosisCode.enum).toEqual(['rust', 'other', 'unknown']);
  });

  it('ranks a code outside the catalogue as unknown without retrying', async () => {
    const generateContent = jest.fn().mockResolvedValue(reply({ hypotheses: [{ diagnosisCode: 'bogus', probability: 0.5, evidence: '' }] }));
    const out = await providerWith(generateContent).analyze(input);
    expect(out.hypotheses[0].diagnosisCode).toBe('unknown');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries invalid output only once and does not leak model output in the error', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: 'secret model text' });
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error).toMatchObject({ code: 'invalid_response', attempts: 2 });
    expect(error.message).not.toContain('secret');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries a failed request up to the configured limit', async () => {
    const generateContent = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(providerWith(generateContent).analyze(input)).rejects.toMatchObject({ code: 'request_failed', attempts: 3 });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('throws a typed timeout error when the request times out', async () => {
    const generateContent = jest.fn().mockRejectedValue(new Error('Request timed out'));
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error).toBeInstanceOf(VisionProviderError);
    expect(error.code).toBe('timeout');
  });

  it('does not leak the underlying message of a failed request', async () => {
    const generateContent = jest.fn().mockRejectedValue(new Error('403 key=test-key'));
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error.code).toBe('request_failed');
    expect(error.message).not.toContain('test-key');
  });
});
