import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import { ReferenceImageEntity } from '../../domain/entities';
import { PLACEHOLDER_PREFIX, REFERENCE_IMAGE_DIR } from './catalog.constants';
import { renderPlaceholderSvg } from './placeholder-image.renderer';

const BYTES_PER_MB = 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/** Stores uploaded reference photos and serves reference images (stored file, trusted remote URL, or generated placeholder). */
@Injectable()
export class ReferenceImageFileService {
  constructor(
    @InjectRepository(ReferenceImageEntity) private readonly images: Repository<ReferenceImageEntity>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async store(file: Express.Multer.File | undefined): Promise<string> {
    const { allowedImageTypes, maxPhotoMb } = this.config.get('storage', { infer: true });
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Image file is required' });
    if (!allowedImageTypes.includes(file.mimetype)) throw new BadRequestException({ code: 'UNSUPPORTED_IMAGE_TYPE', message: 'Unsupported image type' });
    if (file.size > maxPhotoMb * BYTES_PER_MB) throw new BadRequestException({ code: 'IMAGE_TOO_LARGE', message: 'Image is too large' });
    const key = `${randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? extname(file.originalname)}`;
    const dir = this.directory();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, key), file.buffer);
    return key;
  }

  async send(id: string, res: Response): Promise<void> {
    const image = await this.images.findOneBy({ id });
    if (!image) throw new NotFoundException({ code: 'REFERENCE_IMAGE_NOT_FOUND', message: 'Reference image not found' });
    if (/^https?:\/\//.test(image.storageKey)) return res.redirect(image.storageKey);
    if (image.storageKey.startsWith(PLACEHOLDER_PREFIX)) {
      res.type('image/svg+xml').send(renderPlaceholderSvg(image.caption));
      return;
    }
    const path = resolve(this.directory(), image.storageKey);
    if (!path.startsWith(this.directory() + sep)) throw new NotFoundException({ code: 'REFERENCE_IMAGE_NOT_FOUND', message: 'Reference image not found' });
    await new Promise<void>((done, fail) => res.sendFile(path, (err) => (err ? fail(new NotFoundException({ code: 'REFERENCE_IMAGE_NOT_FOUND', message: 'Reference image file is missing' })) : done())));
  }

  private directory(): string {
    return resolve(this.config.get('storage', { infer: true }).dir, REFERENCE_IMAGE_DIR);
  }
}
