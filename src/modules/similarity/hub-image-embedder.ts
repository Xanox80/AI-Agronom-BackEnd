import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';
import { AutoProcessor, PreTrainedModel, Processor, RawImage, Tensor, env } from '@huggingface/transformers';
import { VisionPhoto } from '../vision-provider/vision.types';
import { ImageEncoder, encoderFor } from './image-encoders';
import { SimilarityConfig } from './similarity.config';
import { ImageEmbedder } from './similarity.types';

interface LoadedModel { processor: Processor; model: PreTrainedModel }

export type EmbedderSettings = Pick<SimilarityConfig, 'embedderModel' | 'embedderDtype' | 'embedderDevice' | 'embedderGpuId' | 'modelCacheDir'>;

function unitLength(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function toRawImage(photo: VisionPhoto): Promise<RawImage> {
  return RawImage.fromBlob(new Blob([new Uint8Array(photo.bytes)], { type: photo.mimeType }));
}

/**
 * Image model from the Hugging Face hub (CLIP or DINOv2) run locally through ONNX (transformers.js), on the
 * CPU or a DirectML GPU. Downloaded on first use into SIMILARITY_MODEL_CACHE_DIR, then works offline.
 */
export class HubImageEmbedder implements ImageEmbedder {
  private readonly logger = new Logger(HubImageEmbedder.name);
  private readonly encoder: ImageEncoder;
  private loading: Promise<LoadedModel> | null = null;
  /** Keyed by the photo buffer: the local provider and the reference lookup embed the same photo once. */
  private readonly embedded = new WeakMap<Buffer, Promise<number[]>>();

  constructor(private readonly settings: EmbedderSettings) {
    this.encoder = encoderFor(settings.embedderModel);
  }

  embed(photo: VisionPhoto): Promise<number[]> {
    const cached = this.embedded.get(photo.bytes);
    if (cached) return cached;
    const vector = this.embedMany([photo]).then(([only]) => only);
    this.embedded.set(photo.bytes, vector);
    vector.catch(() => this.embedded.delete(photo.bytes));
    return vector;
  }

  /** One model run for the whole batch: on a GPU this is several times faster than photo by photo. */
  async embedMany(photos: VisionPhoto[]): Promise<number[][]> {
    const { processor, model } = await this.load();
    const images = await Promise.all(photos.map(toRawImage));
    const outputs = await model(await processor(images)) as Record<string, Tensor>;
    return this.encoder.vectors(outputs).map(unitLength);
  }

  /** Loads once and is shared by concurrent callers; a failed load is retried on the next call. */
  private load(): Promise<LoadedModel> {
    this.loading ??= this.loadModel().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  private async loadModel(): Promise<LoadedModel> {
    const { embedderModel, embedderDtype, embedderDevice, embedderGpuId } = this.settings;
    const cacheDir = resolve(this.settings.modelCacheDir);
    mkdirSync(cacheDir, { recursive: true });
    env.cacheDir = cacheDir;
    this.logger.log(`Loading image embedder ${embedderModel} (${embedderDtype}, ${embedderDevice}${embedderDevice === 'dml' ? ` GPU ${embedderGpuId}` : ''}), cache ${cacheDir}`);
    const sessionOptions = embedderDevice === 'dml' ? { executionProviders: [{ name: 'dml', deviceId: embedderGpuId }] } : undefined;
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(embedderModel),
      this.encoder.load(embedderModel, { dtype: embedderDtype, device: embedderDevice, session_options: sessionOptions }),
    ]);
    return { processor, model };
  }
}
