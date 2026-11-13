import { AutoModel, CLIPVisionModelWithProjection, PreTrainedModel, Tensor } from '@huggingface/transformers';

export interface EncoderLoadOptions {
  dtype: string;
  device: string;
  /** Passed to ONNX Runtime as-is, e.g. the DirectML adapter to run on. */
  session_options?: Record<string, unknown>;
}

/** How one model family is loaded and how its outputs become a single vector per image. */
export interface ImageEncoder {
  load(model: string, options: EncoderLoadOptions): Promise<PreTrainedModel>;
  /** One raw (not yet unit-length) vector per image of the batch. */
  vectors(outputs: Record<string, Tensor>): number[][];
}

function rows(tensor: Tensor): number[][] {
  const [batch, width] = tensor.dims;
  const data = tensor.data as Float32Array;
  return Array.from({ length: batch }, (_, b) => Array.from(data.subarray(b * width, (b + 1) * width)));
}

/** CLIP image tower: the projected embedding it was trained to compare with text. */
export class ClipEncoder implements ImageEncoder {
  load(model: string, options: EncoderLoadOptions): Promise<PreTrainedModel> {
    return CLIPVisionModelWithProjection.from_pretrained(model, options as never);
  }

  vectors(outputs: Record<string, Tensor>): number[][] {
    return rows(outputs.image_embeds);
  }
}

/**
 * DINOv2: the class token joined with the mean of the patch tokens, the representation its authors
 * use for linear probes. Patch tokens carry the small lesion detail the class token alone blurs.
 */
export class Dinov2Encoder implements ImageEncoder {
  load(model: string, options: EncoderLoadOptions): Promise<PreTrainedModel> {
    return AutoModel.from_pretrained(model, options as never);
  }

  vectors(outputs: Record<string, Tensor>): number[][] {
    const hidden = outputs.last_hidden_state;
    const [batch, tokens, width] = hidden.dims;
    const data = hidden.data as Float32Array;
    return Array.from({ length: batch }, (_, b) => {
      const offset = b * tokens * width;
      const cls = Array.from(data.subarray(offset, offset + width));
      const mean = new Array<number>(width).fill(0);
      for (let t = 1; t < tokens; t++) {
        const row = offset + t * width;
        for (let j = 0; j < width; j++) mean[j] += data[row + j];
      }
      return [...cls, ...mean.map((sum) => sum / (tokens - 1))];
    });
  }
}

/** Picks the encoder from the hub model id, e.g. "Xenova/clip-vit-base-patch32" or "onnx-community/dinov2-base". */
export function encoderFor(model: string): ImageEncoder {
  const id = model.toLowerCase();
  if (id.includes('dinov2')) return new Dinov2Encoder();
  if (id.includes('clip')) return new ClipEncoder();
  throw new Error(`Unsupported embedder model ${model}: expected a CLIP or DINOv2 model`);
}
