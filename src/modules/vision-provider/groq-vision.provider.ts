import { AppConfig } from '../../config/app-config';
import { RetryingVisionProvider } from './retrying-vision.provider';
import { buildSystemInstruction, buildUserPrompt } from './vision-prompt.builder';
import { RetryHint } from './vision-provider.error';
import { parseVisionResponse } from './vision-response.parser';
import { buildVisionResponseJsonSchema } from './vision-response.schema';
import { VisionInput, VisionOutput } from './vision.types';

/** The slice of the groq-sdk client this provider needs; lets tests inject a fake. */
export interface GroqClient {
  chat: { completions: { create(body: any, options?: { timeout?: number }): Promise<{ choices: { message?: { content?: string | null } }[] }> } };
}

const DAILY_QUOTA_PATTERN = /per day/i;
const MS_PER_SECOND = 1000;

/** Groq OpenAI-compatible chat model with image input; the schema goes in the prompt because strict json_schema mode garbles output. */
export class GroqVisionProvider extends RetryingVisionProvider {
  readonly name = 'groq';
  readonly model: string;
  protected readonly displayName = 'Groq';

  constructor(config: AppConfig['ai'], private readonly client: GroqClient, maxHypotheses: number) {
    super(config, maxHypotheses);
    this.model = config.groqModel;
  }

  protected async requestOnce(input: VisionInput): Promise<VisionOutput> {
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.buildSystemPrompt(input) },
          { role: 'user', content: this.buildUserContent(input) },
        ],
      },
      { timeout: this.config.timeoutMs },
    );
    const text = completion.choices[0]?.message?.content;
    return parseVisionResponse(this.parseJson(text), input.allowedDiagnosisCodes, input.photos.length, this.maxHypotheses);
  }

  /** Groq sends the wait in the retry-after header and names the spent quota ("tokens per day") in the message. */
  protected retryHintOf(error: unknown, message: string): RetryHint {
    const retryAfter = Number(headersOf(error)?.get('retry-after'));
    return {
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter * MS_PER_SECOND) : undefined,
      dailyQuotaExhausted: DAILY_QUOTA_PATTERN.test(message),
    };
  }

  private buildSystemPrompt(input: VisionInput): string {
    const schema = JSON.stringify(buildVisionResponseJsonSchema(input.allowedDiagnosisCodes));
    return `${buildSystemInstruction(this.maxHypotheses)}\n\nReply with one JSON object only, matching this JSON Schema:\n${schema}`;
  }

  private buildUserContent(input: VisionInput) {
    const images = input.photos.map((p) => ({ type: 'image_url', image_url: { url: `data:${p.mimeType};base64,${p.bytes.toString('base64')}` } }));
    return [...images, { type: 'text', text: buildUserPrompt(input) }];
  }
}

function headersOf(error: unknown): { get(name: string): string | null } | undefined {
  const headers = (error as { headers?: { get?: unknown } } | null)?.headers;
  return typeof headers?.get === 'function' ? (headers as { get(name: string): string | null }) : undefined;
}
