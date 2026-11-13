import { GeminiVisionProvider } from './gemini-vision.provider';
import { VisionProviderError } from './vision-provider.error';
import { VisionInput } from './vision.types';

const TOP_K = 3;
const CONFIG = { provider: 'gemini' as const, geminiApiKey: 'test-key', geminiModel: 'test-model', groqApiKey: '', groqModel: 'groq-model', timeoutMs: 1234, maxRetries: 2, retryBaseDelayMs: 0, retryMaxDelayMs: 1000, temperature: 0.2 };

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

const apiError = (status: number, details = '') => Object.assign(new Error(`{"error":{"code":${status}${details}}} key=test-key`), { name: 'ApiError', status });
const quotaDetails = (quotaId: string, retryDelay: string) =>
  `,"details":[{"violations":[{"quotaId":"${quotaId}"}]},{"retryDelay":"${retryDelay}"}]`;

const providerWith =(generateContent: jest.Mock) => new GeminiVisionProvider(CONFIG, { models: { generateContent } }, TOP_K);

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

  it('retries a temporary Gemini overload and succeeds', async () => {
    const generateContent = jest.fn().mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce(reply());
    await expect(providerWith(generateContent).analyze(input)).resolves.toBeDefined();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('keeps the HTTP status of a failed request after exhausting retries', async () => {
    const generateContent = jest.fn().mockRejectedValue(apiError(429));
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error).toMatchObject({ code: 'request_failed', httpStatus: 429, attempts: 3 });
    expect(error.message).toContain('HTTP 429');
  });

  it('does not retry a request Gemini rejects as invalid', async () => {
    const generateContent = jest.fn().mockRejectedValue(apiError(404));
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error).toMatchObject({ code: 'request_failed', httpStatus: 404, attempts: 1 });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('waits exponentially longer between retries', async () => {
    jest.useFakeTimers();
    try {
      const generateContent = jest.fn().mockRejectedValue(apiError(503));
      const provider = new GeminiVisionProvider({ ...CONFIG, retryBaseDelayMs: 100 }, { models: { generateContent } }, TOP_K);
      const done = provider.analyze(input).catch((e) => e);
      await jest.advanceTimersByTimeAsync(99);
      expect(generateContent).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(generateContent).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(199);
      expect(generateContent).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(generateContent).toHaveBeenCalledTimes(3);
      expect(await done).toMatchObject({ httpStatus: 503 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits the delay Gemini asks for on 429, capped by the configured maximum', async () => {
    jest.useFakeTimers();
    try {
      const generateContent = jest.fn()
        .mockRejectedValueOnce(apiError(429, quotaDetails('GenerateRequestsPerMinutePerProjectPerModel', '0.5s')))
        .mockRejectedValueOnce(apiError(429, quotaDetails('GenerateRequestsPerMinutePerProjectPerModel', '37s')))
        .mockResolvedValueOnce(reply());
      const done = providerWith(generateContent).analyze(input);
      await jest.advanceTimersByTimeAsync(499);
      expect(generateContent).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(generateContent).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1000);
      expect(generateContent).toHaveBeenCalledTimes(3);
      await expect(done).resolves.toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry once the daily quota is spent', async () => {
    const generateContent = jest.fn().mockRejectedValue(apiError(429, quotaDetails('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '20s')));
    const error = await providerWith(generateContent).analyze(input).catch((e) => e);
    expect(error).toMatchObject({ httpStatus: 429, attempts: 1, retryable: false });
    expect(generateContent).toHaveBeenCalledTimes(1);
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
