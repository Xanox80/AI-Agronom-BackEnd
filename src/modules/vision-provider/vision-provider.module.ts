import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AppConfig } from '../../config/app-config';
import { GeminiVisionProvider } from './gemini-vision.provider';
import { MockVisionProvider } from './mock-vision.provider';
import { VISION_PROVIDER, VisionProvider } from './vision.types';

export function createVisionProvider(ai: AppConfig['ai'], maxHypotheses: number): VisionProvider {
  if (ai.provider === 'mock') return new MockVisionProvider(maxHypotheses);
  if (!ai.geminiApiKey) {
    new Logger('VisionProviderModule').warn('GEMINI_API_KEY is not set; falling back to the mock vision provider');
    return new MockVisionProvider(maxHypotheses);
  }
  return new GeminiVisionProvider(ai, new GoogleGenAI({ apiKey: ai.geminiApiKey }), maxHypotheses);
}

@Module({
  providers: [
    {
      provide: VISION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => createVisionProvider(config.get('ai', { infer: true }), config.get('recognition', { infer: true }).topK),
    },
  ],
  exports: [VISION_PROVIDER],
})
export class VisionProviderModule {}
