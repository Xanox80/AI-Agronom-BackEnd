import { GeminiVisionProvider } from './gemini-vision.provider';
import { MockVisionProvider } from './mock-vision.provider';
import { createVisionProvider } from './vision-provider.module';

const ai = { provider: 'gemini' as const, geminiApiKey: 'k', geminiModel: 'm', geminiTimeoutMs: 1, geminiMaxRetries: 0, temperature: 0 };

describe('createVisionProvider', () => {
  it('uses Gemini when configured with a key', () => {
    expect(createVisionProvider(ai, 3)).toBeInstanceOf(GeminiVisionProvider);
  });

  it('uses the mock when AI_PROVIDER is mock', () => {
    expect(createVisionProvider({ ...ai, provider: 'mock' }, 3)).toBeInstanceOf(MockVisionProvider);
  });

  it('falls back to the mock when the key is missing', () => {
    expect(createVisionProvider({ ...ai, geminiApiKey: '' }, 3)).toBeInstanceOf(MockVisionProvider);
  });
});
