import { GoogleGenAI } from '@google/genai';
import { buildConfig } from '../../config/configuration';
import { GeminiVisionProvider } from './gemini-vision.provider';

const apiKey = process.env.GEMINI_API_KEY ?? '';
const live = process.env.RUN_LIVE_GEMINI === '1' && apiKey ? describe : describe.skip;

const config = buildConfig(process.env);
const BLANK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

live('GeminiVisionProvider live smoke test', () => {
  it('returns a schema-valid answer for a blank image', async () => {
    const provider = new GeminiVisionProvider(
      config.ai,
      new GoogleGenAI({ apiKey }),
      config.recognition.topK,
    );
    const out = await provider.analyze({
      photos: [{ bytes: Buffer.from(BLANK_PNG_BASE64, 'base64'), mimeType: 'image/png' }],
      context: { cropCode: 'wheat_winter' },
      allowedDiagnosisCodes: ['septoria', 'rust'],
      locale: 'uk',
    });
    expect(Array.isArray(out.hypotheses)).toBe(true);
    expect(typeof out.outOfDistribution).toBe('boolean');
  }, config.ai.timeoutMs * (config.ai.maxRetries + 1) + 5000);
});
