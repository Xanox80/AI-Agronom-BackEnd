import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { parseArgs } from 'util';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from './config/configuration';
import { SEED_DIAGNOSES } from './modules/catalog/seed/seed-diagnoses';
import { ClassifierFile } from './modules/similarity/classifier/reference-classifier.service';
import { SoftmaxModel, trainSoftmaxInBackground } from './modules/similarity/classifier/softmax-classifier';
import { balanceSources } from './modules/similarity/classifier/source-balance';
import { HubImageEmbedder } from './modules/similarity/hub-image-embedder';
import { readClassMapping } from './modules/similarity/indexing/class-mapping';
import { scanDataset } from './modules/similarity/indexing/dataset-scanner';
import { CurvePoint } from './modules/similarity/lab/lab-charts';
import { DatasetEmbedder } from './modules/similarity/lab/dataset-embedder';
import { EmbeddingCache, embedderSlug } from './modules/similarity/lab/embedding-cache';
import { evaluate, quickAccuracy, TestPhoto } from './modules/similarity/lab/lab-evaluation';
import { LabExperiment, readLabExperiment } from './modules/similarity/lab/lab-experiment';
import { renderLabReport } from './modules/similarity/lab/lab-report';
import { countByCode, LabSamples, splitSamples } from './modules/similarity/lab/lab-samples';
import { RunHistory } from './modules/similarity/lab/run-history';
import { SIMILARITY_CONFIG, SimilarityConfig } from './modules/similarity/similarity.config';
import { SimilarityModule } from './modules/similarity/similarity.module';

const USAGE = 'npm run lab -- --experiment <recipe.json> [--save-classifier]';
const CURVE_POINTS = 30;
const MISTAKES_SHOWN = 24;
const logger = new Logger('Lab');

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), SimilarityModule] })
class LabConfigModule {}

async function readConfig(): Promise<SimilarityConfig> {
  const app = await NestFactory.createApplicationContext(LabConfigModule, { logger: ['warn', 'error'] });
  const config = app.get<SimilarityConfig>(SIMILARITY_CONFIG);
  await app.close();
  // The context's quiet logger setting is global; progress lines must print again.
  Logger.overrideLogger(['log', 'warn', 'error']);
  return config;
}

/** Embeds (or reads from cache) every dataset of the recipe. Photos already deleted are taken from the cache. */
async function collectSamples(experiment: LabExperiment, config: SimilarityConfig, cache: EmbeddingCache): Promise<LabSamples> {
  const embedder = new DatasetEmbedder(
    new HubImageEmbedder({ ...config, embedderModel: experiment.embedder.model, embedderDtype: experiment.embedder.dtype }), cache, config.indexBatchSize,
  );
  const all: LabSamples = { train: [], test: [] };
  for (const dataset of experiment.datasets) {
    const mapping = readClassMapping(resolve(dataset.mapping));
    const folder = resolve(config.datasetsDir, dataset.folder);
    const images = existsSync(folder) ? scanDataset(folder).filter((image) => mapping.classes[image.label]) : [];
    const photos = images.length
      ? await embedder.embed(mapping.source, images, (p) => logger.log(`${mapping.source}: ${p.embedded + p.reused}/${p.total} photos, ${p.failed} unreadable`))
      : cache.load(mapping.source);
    logger.log(`${mapping.source}: ${photos.length} photos${images.length ? '' : ' (from cache, photos not on disk)'}`);
    const samples = splitSamples(photos, mapping, folder, experiment.testFraction);
    all.train.push(...samples.train);
    all.test.push(...samples.test);
  }
  return all;
}

async function train(experiment: LabExperiment, config: SimilarityConfig, samples: LabSamples, test: TestPhoto[]) {
  const loss: CurvePoint[] = [];
  const testAccuracy: CurvePoint[] = [];
  const every = Math.max(1, Math.round(experiment.training.epochs / CURVE_POINTS));
  const model = await trainSoftmaxInBackground(balanceSources(samples.train, config.trainMaxSampleWeight), experiment.training, (progress) => {
    loss.push({ epoch: progress.epoch, value: progress.loss });
    if (progress.epoch % every && progress.epoch !== experiment.training.epochs) return;
    const accuracy = quickAccuracy(progress.snapshot(), test);
    testAccuracy.push({ epoch: progress.epoch, value: accuracy });
    logger.log(`epoch ${progress.epoch}/${experiment.training.epochs}: loss ${progress.loss.toFixed(4)}, test accuracy ${(accuracy * 100).toFixed(1)}%`);
  });
  return { model, loss, testAccuracy };
}

/** The production probe is fitted on every photo, test ones included: the report already measured the recipe. */
async function saveClassifier(experiment: LabExperiment, config: SimilarityConfig, samples: LabSamples, accuracy: number): Promise<void> {
  const everything = [...samples.train, ...samples.test.map(({ vector, label, source }) => ({ vector, label, source }))];
  const model: SoftmaxModel = await trainSoftmaxInBackground(balanceSources(everything, config.trainMaxSampleWeight), experiment.training);
  const file: ClassifierFile = {
    embedderModel: experiment.embedder.model, embedderDtype: experiment.embedder.dtype, trainedAt: new Date().toISOString(),
    sampleCounts: countByCode(everything), validationAccuracy: accuracy, model,
  };
  writeFileSync(resolve(config.classifierPath), JSON.stringify(file));
  logger.log(`Saved classifier to ${resolve(config.classifierPath)}; set SIMILARITY_EMBEDDER_MODEL=${file.embedderModel} and DTYPE=${file.embedderDtype} in .env`);
}

/** Trains the reference classifier on one recipe, measures it on held-out photos and writes an HTML report. */
async function runLab(): Promise<void> {
  const { values } = parseArgs({ options: { experiment: { type: 'string' }, 'save-classifier': { type: 'boolean', default: false } } });
  if (!values.experiment) throw new Error(`Usage: ${USAGE}`);
  const started = Date.now();
  const experiment = readLabExperiment(resolve(values.experiment));
  const config = await readConfig();
  const labDir = resolve(config.labDir);
  const cache = new EmbeddingCache(join(labDir, 'embeddings', embedderSlug(experiment.embedder.model, experiment.embedder.dtype)));

  const samples = await collectSamples(experiment, config, cache);
  logger.log(`${samples.train.length} training and ${samples.test.length} test photos`);
  const { model, loss, testAccuracy } = await train(experiment, config, samples, samples.test);
  const evaluation = evaluate(model, samples.test, MISTAKES_SHOWN);

  const names = new Map(SEED_DIAGNOSES.map((d) => [d.code, d.nameUk]));
  const history = new RunHistory(join(labDir, 'runs.jsonl'));
  const reportFile = join(labDir, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}-${experiment.name}.html`);
  const seconds = (Date.now() - started) / 1000;
  history.add({
    finishedAt: new Date().toISOString(), name: experiment.name, embedderModel: experiment.embedder.model, embedderDtype: experiment.embedder.dtype,
    classes: evaluation.perClass.length, trainPhotos: samples.train.length, testPhotos: samples.test.length, accuracy: evaluation.accuracy,
    top3Accuracy: evaluation.top3Accuracy, macroF1: evaluation.macroF1, seconds, report: reportFile,
  });
  mkdirSync(join(labDir, 'reports'), { recursive: true });
  writeFileSync(reportFile, renderLabReport({
    experiment, evaluation, trainCounts: countByCode(samples.train), loss, testAccuracy, history: history.all(), seconds,
    nameOf: (code) => names.get(code) ?? code,
  }));
  logger.log(`Accuracy ${(evaluation.accuracy * 100).toFixed(1)}%, top-3 ${(evaluation.top3Accuracy * 100).toFixed(1)}%, macro F1 ${evaluation.macroF1.toFixed(3)}`);
  logger.log(`Report: ${reportFile}`);
  if (values['save-classifier']) await saveClassifier(experiment, config, samples, evaluation.accuracy);
}

runLab().catch((error: Error) => {
  logger.error(error.stack ?? error.message);
  process.exitCode = 1;
});
