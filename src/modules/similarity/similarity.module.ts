import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassifierTrainer } from './classifier/classifier-trainer.service';
import { ReferenceClassifier } from './classifier/reference-classifier.service';
import { HubImageEmbedder } from './hub-image-embedder';
import { QdrantReferenceIndex } from './qdrant-reference-index';
import { SimilarCaseFinder } from './similar-case-finder.service';
import { SIMILARITY_CONFIG, SIMILARITY_ENV_KEYS, SimilarityConfig, buildSimilarityConfig } from './similarity.config';
import { IMAGE_EMBEDDER, REFERENCE_INDEX } from './similarity.types';

/** Labelled reference photos in Qdrant, looked up by image embedding (kNN evidence for recognition). */
@Module({
  providers: [
    {
      provide: SIMILARITY_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildSimilarityConfig(
        Object.fromEntries(SIMILARITY_ENV_KEYS.map((key) => [key, config.get<string>(key)])),
      ),
    },
    { provide: IMAGE_EMBEDDER, inject: [SIMILARITY_CONFIG], useFactory: (config: SimilarityConfig) => new HubImageEmbedder(config) },
    { provide: REFERENCE_INDEX, inject: [SIMILARITY_CONFIG], useFactory: (config: SimilarityConfig) => new QdrantReferenceIndex(config) },
    ReferenceClassifier, ClassifierTrainer, SimilarCaseFinder,
  ],
  exports: [SimilarCaseFinder, ReferenceClassifier, ClassifierTrainer, SIMILARITY_CONFIG, IMAGE_EMBEDDER, REFERENCE_INDEX],
})
export class SimilarityModule {}
