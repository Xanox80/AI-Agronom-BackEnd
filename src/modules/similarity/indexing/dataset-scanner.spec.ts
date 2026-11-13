import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { capPerLabel, countByLabel, scanDataset } from './dataset-scanner';

describe('dataset scanner', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dataset-'));
    const files = ['color/Corn_healthy/a.JPG', 'color/Corn_healthy/b.png', 'color/Corn_blight/c.jpeg', 'color/Corn_blight/notes.txt'];
    files.forEach((file) => {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), 'x');
    });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('labels images by their parent folder and skips non-images', () => {
    const images = scanDataset(root);

    expect(images.map((i) => [i.relativePath, i.label, i.mimeType])).toEqual([
      ['color/Corn_blight/c.jpeg', 'Corn_blight', 'image/jpeg'],
      ['color/Corn_healthy/a.JPG', 'Corn_healthy', 'image/jpeg'],
      ['color/Corn_healthy/b.png', 'Corn_healthy', 'image/png'],
    ]);
  });

  it('counts images per label', () => {
    expect(Object.fromEntries(countByLabel(scanDataset(root)))).toEqual({ Corn_blight: 1, Corn_healthy: 2 });
  });

  it('caps each label independently and treats 0 as no cap', () => {
    const images = scanDataset(root);

    expect(Object.fromEntries(countByLabel(capPerLabel(images, 1)))).toEqual({ Corn_blight: 1, Corn_healthy: 1 });
    expect(capPerLabel(images, 0)).toHaveLength(3);
  });

  it('spreads the capped sample over the whole folder instead of taking the first files', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ absolutePath: `${i}`, relativePath: `${i}`, label: 'A', mimeType: 'image/jpeg' }));

    expect(capPerLabel(many, 3).map((image) => image.relativePath)).toEqual(['0', '3', '6']);
  });
});
