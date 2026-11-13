import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { parseArgs } from 'util';
import { Logger } from '@nestjs/common';
import { GbifPage, GbifPhoto, occurrenceSearchUrl, openPhotos } from './modules/similarity/datasets/gbif-photo-source';

const USAGE = 'npm run fetch:gbif -- --taxon <GBIF taxon key> --label <class folder> [--out data/datasets/gbif] [--max 600]';
const INATURALIST_RESEARCH_GRADE = '50c9509d-22c7-4a22-a47d-8c48425ef4a7';
const PAGE_SIZE = 300;
const PARALLEL_DOWNLOADS = 8;
const logger = new Logger('FetchGbifPhotos');

function readArgs() {
  const { values } = parseArgs({
    options: {
      taxon: { type: 'string' }, label: { type: 'string' }, out: { type: 'string', default: 'data/datasets/gbif' },
      max: { type: 'string', default: '600' }, size: { type: 'string', default: 'medium' },
      dataset: { type: 'string', default: INATURALIST_RESEARCH_GRADE },
    },
  });
  if (!values.taxon || !values.label) throw new Error(`Usage: ${USAGE}`);
  return { taxonKey: Number(values.taxon), label: values.label, out: resolve(values.out), max: Number(values.max), size: values.size, datasetKey: values.dataset };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GBIF answered ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

/** Saves one photo unless already there; a failed download is skipped, the licence credit is kept beside it. */
async function save(photo: GbifPhoto, folder: string, creditsFile: string, label: string): Promise<boolean> {
  const path = join(folder, photo.fileName);
  if (existsSync(path)) return true;
  const response = await fetch(photo.url);
  if (!response.ok) return false;
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  appendFileSync(creditsFile, [label, photo.fileName, photo.license, photo.credit, photo.sourcePage].map((v) => `"${v.replace(/"/g, '""')}"`).join(',') + '\n');
  return true;
}

/** Downloads openly licensed iNaturalist photos of one species into a class folder, ready for npm run lab. */
async function fetchGbifPhotos(): Promise<void> {
  const args = readArgs();
  const folder = join(args.out, args.label);
  mkdirSync(folder, { recursive: true });
  const creditsFile = join(args.out, 'credits.csv');
  if (!existsSync(creditsFile)) writeFileSync(creditsFile, 'label,file,license,credit,source\n');

  let saved = 0;
  for (let offset = 0; saved < args.max; offset += PAGE_SIZE) {
    const page = await fetchJson<GbifPage>(occurrenceSearchUrl({ taxonKey: args.taxonKey, datasetKey: args.datasetKey, offset, limit: PAGE_SIZE }));
    const photos = openPhotos(page, args.size).slice(0, args.max - saved);
    for (let i = 0; i < photos.length; i += PARALLEL_DOWNLOADS) {
      const results = await Promise.all(photos.slice(i, i + PARALLEL_DOWNLOADS).map((photo) => save(photo, folder, creditsFile, args.label).catch(() => false)));
      saved += results.filter(Boolean).length;
    }
    logger.log(`${args.label}: ${saved} photos (offset ${offset + PAGE_SIZE})`);
    if (page.endOfRecords) break;
  }
  logger.log(`Done: ${saved} openly licensed photos in ${folder}; credits in ${creditsFile}`);
}

fetchGbifPhotos().catch((error: Error) => {
  logger.error(error.message);
  process.exitCode = 1;
});
