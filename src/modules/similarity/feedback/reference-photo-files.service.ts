import { readFile } from 'fs/promises';
import { extname, resolve, sep } from 'path';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PHOTO_STORAGE, PhotoStorage } from '../../observations/storage/photo-storage';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity.config';
import { CONFIRMED_SOURCE, REFERENCE_INDEX, ReferenceIndex, ReferencePayload } from '../similarity.types';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

export interface PhotoFile {
  bytes: Buffer;
  mimeType: string;
}

/** Bytes of a labelled reference photo: from the dataset folder, or from photo storage for confirmed observations. */
@Injectable()
export class ReferencePhotoFiles {
  constructor(
    @Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig,
    @Inject(REFERENCE_INDEX) private readonly index: ReferenceIndex,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
  ) {}

  async read(pointId: string): Promise<PhotoFile> {
    const payload = await this.index.payloadOf(pointId);
    const mimeType = payload && MIME_BY_EXTENSION[extname(payload.imagePath).toLowerCase()];
    if (!payload || !mimeType) throw new NotFoundException('FILE_NOT_FOUND');
    const bytes = payload.source === CONFIRMED_SOURCE ? await this.storage.read(payload.imagePath) : await this.datasetFile(payload);
    return { bytes, mimeType };
  }

  /** Confined to SIMILARITY_DATASETS_DIR: payload paths come from the database, never trusted as-is. */
  private async datasetFile(payload: ReferencePayload): Promise<Buffer> {
    if (payload.datasetRoot === undefined) throw new NotFoundException('FILE_NOT_FOUND');
    const root = resolve(this.config.datasetsDir);
    const path = resolve(root, payload.datasetRoot, payload.imagePath);
    if (!path.startsWith(root + sep)) throw new NotFoundException('FILE_NOT_FOUND');
    try {
      return await readFile(path);
    } catch {
      throw new NotFoundException('FILE_NOT_FOUND');
    }
  }
}
