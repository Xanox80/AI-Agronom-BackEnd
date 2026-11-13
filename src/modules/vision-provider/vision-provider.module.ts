import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { AppConfig } from '../../config/app-config';
import { ReferenceClassifier } from '../similarity/classifier/reference-classifier.service';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity/similarity.config';
import { SimilarityModule } from '../similarity/similarity.module';
import { IMAGE_EMBEDDER, ImageEmbedder } from '../similarity/similarity.types';
import { GeminiVisionProvider } from './gemini-vision.provider';
import { GroqVisionProvider } from './groq-vision.provider';
import { LocalVisionProvider } from './local-vision.provider';
import { MockVisionProvider } from './mock-vision.provider';
import { VISION_PROVIDER, VisionProvider } from './vision.types';

/** `local` is passed in lazily: it needs the similarity module's embedder and trained classifier. */
export function createVisionProvider(ai: AppConfig['ai'], maxHypotheses: number, local?: () => VisionProvider): VisionProvider {
  if (ai.provider === 'mock') return new MockVisionProvider(maxHypotheses);
  if (ai.provider === 'local') {
    if (!local) throw new Error('AI_PROVIDER=local needs the similarity module');
    return local();
  }
  const [apiKey, keyName] = ai.provider === 'groq' ? [ai.groqApiKey, 'GROQ_API_KEY'] : [ai.geminiApiKey, 'GEMINI_API_KEY'];
  if (!apiKey) {
    new Logger('VisionProviderModule').warn(`${keyName} is not set; falling back to the mock vision provider`);
    return new MockVisionProvider(maxHypotheses);
  }
  if (ai.provider === 'groq') return new GroqVisionProvider(ai, new Groq({ apiKey, maxRetries: 0 }), maxHypotheses);
  return new GeminiVisionProvider(ai, new GoogleGenAI({ apiKey }), maxHypotheses);
}

@Module({
  imports: [SimilarityModule],
  providers: [
    {
      provide: VISION_PROVIDER,
      inject: [ConfigService, SIMILARITY_CONFIG, IMAGE_EMBEDDER, ReferenceClassifier],
      useFactory: (config: ConfigService<AppConfig, true>, similarity: SimilarityConfig, embedder: ImageEmbedder, classifier: ReferenceClassifier) => {
        const topK = config.get('recognition', { infer: true }).topK;
        return createVisionProvider(config.get('ai', { infer: true }), topK,
          () => new LocalVisionProvider(`${similarity.embedderModel}+reference-classifier`, embedder, classifier, topK));
      },
    },
  ],
  exports: [VISION_PROVIDER],
})
export class VisionProviderModule {}
