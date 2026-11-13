import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { DatasetImage } from '../indexing/dataset-scanner';
import { shrinkImages, shrunkPath } from './photo-shrinker';

describe('photo-shrinker', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'shrink-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const image = (path: string): DatasetImage => ({ absolutePath: path, relativePath: 'Rust/a.png', label: 'Rust', mimeType: 'image/png' });

  it('keeps the class folder and turns every copy into a jpg', () => {
    expect(shrunkPath('/out', image('/in/Rust/a.png'))).toBe(join('/out', 'Rust/a.jpg'));
  });

  it('downsizes the longest side and counts unreadable files as failed', async () => {
    const source = join(dir, 'a.png');
    await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#3a7' } }).png().toFile(source);
    const out = join(dir, 'out');

    const progress = await shrinkImages([image(source), { ...image(join(dir, 'missing.png')), relativePath: 'Rust/b.png' }], out, { maxSide: 512, jpegQuality: 85 }, () => undefined);

    expect(progress).toEqual({ done: 2, total: 2, failed: 1 });
    expect(await sharp(join(out, 'Rust/a.jpg')).metadata()).toMatchObject({ width: 512, height: 256, format: 'jpeg' });
  });
});
