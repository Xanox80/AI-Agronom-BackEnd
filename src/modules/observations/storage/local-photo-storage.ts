import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/app-config';
import { PhotoStorage } from './photo-storage';

@Injectable()
export class LocalPhotoStorage implements PhotoStorage {
  private readonly root: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.root = resolve(config.get('storage', { infer: true }).dir);
  }

  async save(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.pathOf(key));
    } catch {
      throw new NotFoundException('FILE_NOT_FOUND');
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new NotFoundException('FILE_NOT_FOUND');
    return path;
  }
}
