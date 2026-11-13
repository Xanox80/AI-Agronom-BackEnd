import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from './config/configuration';
import { ClassifierTrainer } from './modules/similarity/classifier/classifier-trainer.service';
import { SIMILARITY_CONFIG, SimilarityConfig } from './modules/similarity/similarity.config';
import { SimilarityModule } from './modules/similarity/similarity.module';

const logger = new Logger('TrainClassifier');

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), SimilarityModule] })
class ClassifierTrainingModule {}

/** Trains the reference classifier on the Qdrant collection and reports its held-out accuracy. */
async function trainClassifier(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ClassifierTrainingModule, { logger: ['log', 'warn', 'error'] });
  try {
    const config = app.get<SimilarityConfig>(SIMILARITY_CONFIG);
    if (!config.qdrantUrl) throw new Error('QDRANT_URL is not set in .env');
    const { path, file } = await app.get(ClassifierTrainer).train(true);
    logger.log(`Trained on ${JSON.stringify(file.sampleCounts)}`);
    logger.log(`Held-out accuracy ${file.validationAccuracy.toFixed(3)}; saved ${path}`);
  } finally {
    await app.close();
  }
}

trainClassifier().catch((error: Error) => {
  logger.error(error.message);
  process.exitCode = 1;
});
