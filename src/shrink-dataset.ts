import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { Logger } from '@nestjs/common';
import { shrinkImages } from './modules/similarity/datasets/photo-shrinker';
import { capPerLabel, countByLabel, scanDataset } from './modules/similarity/indexing/dataset-scanner';

const USAGE = 'npm run shrink:dataset -- --from <folder> --to <folder> [--labels "A,B"] [--max-per-class 800] [--max-side 512] [--quality 85]';
const logger = new Logger('ShrinkDataset');

function readArgs() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' }, to: { type: 'string' }, labels: { type: 'string', default: '' },
      'max-per-class': { type: 'string', default: '800' }, 'max-side': { type: 'string', default: '512' },
      quality: { type: 'string', default: '85' },
    },
  });
  if (!values.from || !values.to) throw new Error(`Usage: ${USAGE}`);
  const from = resolve(values.from);
  if (!existsSync(from)) throw new Error(`Dataset folder not found: ${from}`);
  const labels = values.labels.split(',').map((label) => label.trim()).filter(Boolean);
  return { from, to: resolve(values.to), labels, maxPerClass: Number(values['max-per-class']), maxSide: Number(values['max-side']), quality: Number(values.quality) };
}

/** Copies the wanted classes of a downloaded dataset as small JPEGs, so the originals can be deleted. */
async function shrinkDataset(): Promise<void> {
  const args = readArgs();
  const wanted = scanDataset(args.from).filter((image) => !args.labels.length || args.labels.includes(image.label));
  const selected = capPerLabel(wanted, args.maxPerClass);
  countByLabel(selected).forEach((count, label) => logger.log(`  ${label}: ${count}`));
  const result = await shrinkImages(selected, args.to, { maxSide: args.maxSide, jpegQuality: args.quality }, (p) => logger.log(`${p.done}/${p.total}, ${p.failed} failed`));
  logger.log(`Done: ${result.done - result.failed} photos in ${args.to}`);
}

shrinkDataset().catch((error: Error) => {
  logger.error(error.message);
  process.exitCode = 1;
});
