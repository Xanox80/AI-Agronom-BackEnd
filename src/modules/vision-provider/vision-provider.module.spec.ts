import { GeminiVisionProvider } from './gemini-vision.provider';
import { GroqVisionProvider } from './groq-vision.provider';
import { MockVisionProvider } from './mock-vision.provider';
import { createVisionProvider } from './vision-provider.module';

const ai = { provider: 'gemini' as const, geminiApiKey: 'k', geminiModel: 'm', groqApiKey: 'g', groqModel: 'gm', timeoutMs: 1, maxRetries: 0, retryBaseDelayMs: 0, retryMaxDelayMs: 0, temperature: 0 };

describe('createVisionProvider', () => {
  it('uses Gemini when configured with a key', () => {
    expect(createVisionProvider(ai, 3)).toBeInstanceOf(GeminiVisionProvider);
  });

  it('uses Groq when AI_PROVIDER is groq and its key is set', () => {
    expect(createVisionProvider({ ...ai, provider: 'groq' }, 3)).toBeInstanceOf(GroqVisionProvider);
  });

  it('falls back to the mock when the Groq key is missing', () => {
    expect(createVisionProvider({ ...ai, provider: 'groq', groqApiKey: '' }, 3)).toBeInstanceOf(MockVisionProvider);
  });

  it('uses the mock when AI_PROVIDER is mock', () => {
    expect(createVisionProvider({ ...ai, provider: 'mock' }, 3)).toBeInstanceOf(MockVisionProvider);
  });

  it('uses the local model when AI_PROVIDER is local', () => {
    const local = { name: 'local', model: 'clip+probe', analyze: jest.fn() };

    expect(createVisionProvider({ ...ai, provider: 'local' }, 3, () => local)).toBe(local);
  });

  it('refuses local without the similarity module', () => {
    expect(() => createVisionProvider({ ...ai, provider: 'local' }, 3)).toThrow('similarity');
  });

  it('falls back to the mock when the key is missing', () => {
    expect(createVisionProvider({ ...ai, geminiApiKey: '' }, 3)).toBeInstanceOf(MockVisionProvider);
  });
});
