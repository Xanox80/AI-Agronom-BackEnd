import { AppConfig } from '../../config/app-config';
import { RetryingVisionProvider } from './retrying-vision.provider';
import { buildSystemInstruction, buildUserPrompt } from './vision-prompt.builder';
import { RetryHint } from './vision-provider.error';
import { parseVisionResponse } from './vision-response.parser';
import { buildVisionResponseSchema } from './vision-response.schema';
import { VisionInput, VisionOutput } from './vision.types';

/** The slice of the @google/genai client this provider needs; lets tests inject a fake. */
export interface GeminiClient {
  models: { generateContent(params: any): Promise<{ text?: string }> };
}

const RETRY_DELAY_PATTERN = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/;
const DAILY_QUOTA_PATTERN = /PerDay/;
const MS_PER_SECOND = 1000;

export class GeminiVisionProvider extends RetryingVisionProvider {
  readonly name = 'gemini';
  readonly model: string;
  protected readonly displayName = 'Gemini';

  constructor(config: AppConfig['ai'], private readonly client: GeminiClient, maxHypotheses: number) {
    super(config, maxHypotheses);
    this.model = config.geminiModel;
  }

  protected async requestOnce(input: VisionInput): Promise<VisionOutput> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: this.buildParts(input) }],
      config: {
        systemInstruction: buildSystemInstruction(this.maxHypotheses),
        temperature: this.config.temperature,
        responseMimeType: 'application/json',
        responseSchema: buildVisionResponseSchema(input.allowedDiagnosisCodes),
        httpOptions: { timeout: this.config.timeoutMs },
      },
    });
    return parseVisionResponse(this.parseJson(response.text), input.allowedDiagnosisCodes, input.photos.length, this.maxHypotheses);
  }

  /** Reads only the retry delay and the quota kind from a Gemini 429 body (google.rpc RetryInfo / QuotaFailure). */
  protected retryHintOf(_error: unknown, message: string): RetryHint {
    const delay = RETRY_DELAY_PATTERN.exec(message);
    return {
      retryAfterMs: delay ? Math.ceil(Number(delay[1]) * MS_PER_SECOND) : undefined,
      dailyQuotaExhausted: DAILY_QUOTA_PATTERN.test(message),
    };
  }

  private buildParts(input: VisionInput) {
    const images = input.photos.map((p) => ({ inlineData: { data: p.bytes.toString('base64'), mimeType: p.mimeType } }));
    return [...images, { text: buildUserPrompt(input) }];
  }
}
