import { existsSync } from 'fs';
import { isAbsolute, relative, resolve, sep } from 'path';
import { parseArgs } from 'util';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from './config/configuration';
import { SEED_DIAGNOSES } from './modules/catalog/seed/seed-diagnoses';
import { ClassMapping, readClassMapping } from './modules/similarity/indexing/class-mapping';
import { DatasetImage, capPerLabel, countByLabel, scanDataset } from './modules/similarity/indexing/dataset-scanner';
import { ReferenceIndexer } from './modules/similarity/indexing/reference-indexer';
import { SIMILARITY_CONFIG, SimilarityConfig } from './modules/similarity/similarity.config';
import { SimilarityModule } from './modules/similarity/similarity.module';
import { IMAGE_EMBEDDER, ImageEmbedder, REFERENCE_INDEX, ReferenceIndex } from './modules/similarity/similarity.types';

const USAGE = 'npm run index:references -- --dataset <folder> --mapping <file.json> [--max-per-class N] [--replace] [--dry-run]';
const logger = new Logger('IndexReferences');

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), SimilarityModule] })
class ReferenceIndexingModule {}

function readArgs() {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string' }, mapping: { type: 'string' },
      'max-per-class': { type: 'string', default: '0' }, 'dry-run': { type: 'boolean', default: false },
      replace: { type: 'boolean', default: false },
    },
  });
  if (!values.dataset || !values.mapping) throw new Error(`Usage: ${USAGE}`);
  const dataset = resolve(values.dataset);
  if (!existsSync(dataset)) throw new Error(`Dataset folder not found: ${dataset}`);
  return { dataset, mapping: readClassMapping(resolve(values.mapping)), maxPerClass: Number(values['max-per-class']), dryRun: values['dry-run'], replace: values.replace };
}

/** Dataset folder relative to SIMILARITY_DATASETS_DIR, or undefined (photos then cannot be shown for comparison). */
function datasetRootOf(dataset: string, datasetsDir: string): string | undefined {
  const root = relative(resolve(datasetsDir), dataset);
  if (root.startsWith('..') || isAbsolute(root)) {
    logger.warn(`${dataset} is outside SIMILARITY_DATASETS_DIR; its photos will not be shown for comparison`);
    return undefined;
  }
  return root.split(sep).join('/');
}

/** Prints mapped vs unmapped labels and flags codes the seed catalogue does not know. */
function reportMapping(images: DatasetImage[], mapping: ClassMapping): void {
  const codes = new Set(SEED_DIAGNOSES.map((d) => d.code));
  const crops = new Set(SEED_DIAGNOSES.flatMap((d) => d.cropCodes));
  for (const [label, count] of countByLabel(images)) {
    const mapped = mapping.classes[label];
    logger.log(mapped ? `  + ${label} (${count}) -> ${mapped.diagnosisCode} / ${mapped.cropCode}` : `  - ${label} (${count}) not in mapping, skipped`);
    if (mapped && !codes.has(mapped.diagnosisCode)) logger.warn(`    diagnosisCode ${mapped.diagnosisCode} is not in the seed catalogue`);
    if (mapped && !crops.has(mapped.cropCode)) logger.warn(`    cropCode ${mapped.cropCode} is not a known crop`);
  }
}

async function indexReferences(): Promise<void> {
  const args = readArgs();
  const all = scanDataset(args.dataset);
  logger.log(`Found ${all.length} images in ${args.dataset}`);
  reportMapping(all, args.mapping);
  const selected = capPerLabel(all.filter((image) => args.mapping.classes[image.label]), args.maxPerClass);
  logger.log(`${selected.length} images selected for source "${args.mapping.source}"`);
  if (args.dryRun || !selected.length) return;

  const app = await NestFactory.createApplicationContext(ReferenceIndexingModule, { logger: ['log', 'warn', 'error'] });
  try {
    const config = app.get<SimilarityConfig>(SIMILARITY_CONFIG);
    if (!config.qdrantUrl) throw new Error('QDRANT_URL is not set in .env');
    const index = app.get<ReferenceIndex>(REFERENCE_INDEX);
    if (args.replace) {
      await index.removeSource(args.mapping.source);
      logger.log(`Removed existing points of source "${args.mapping.source}"`);
    }
    const indexer = new ReferenceIndexer(app.get<ImageEmbedder>(IMAGE_EMBEDDER), index, config.indexBatchSize);
    const result = await indexer.indexImages(selected, args.mapping, datasetRootOf(args.dataset, config.datasetsDir), (p) => logger.log(`${p.done}/${p.total} embedded, ${p.failed} failed`));
    logger.log(`Done: ${result.done - result.failed} points in collection "${config.collection}", ${result.failed} images skipped`);
  } finally {
    await app.close();
  }
}

/** fetch hides the real reason (refused, DNS, TLS) in `cause`. */
function describe(error: Error): string {
  const cause = (error.cause as { code?: string; message?: string } | undefined);
  const detail = cause ? ` (${cause.code ?? cause.message})` : '';
  const hint = error.message === 'fetch failed' ? ': Qdrant is unreachable, check QDRANT_URL and that the server is running' : '';
  return `${error.message}${detail}${hint}`;
}

indexReferences().catch((error: Error) => {
  logger.error(describe(error));
  process.exitCode = 1;
});
