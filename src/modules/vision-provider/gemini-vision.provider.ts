import { AppConfig } from '../../config/app-config';
import { buildSystemInstruction, buildUserPrompt } from './vision-prompt.builder';
import { VisionProviderError, VisionProviderErrorCode } from './vision-provider.error';
import { InvalidVisionResponseError, parseVisionResponse } from './vision-response.parser';
import { buildVisionResponseSchema } from './vision-response.schema';
import { VisionInput, VisionOutput, VisionProvider } from './vision.types';

/** The slice of the @google/genai client this provider needs; lets tests inject a fake. */
export interface GeminiClient {
  models: { generateContent(params: any): Promise<{ text?: string }> };
}

const INVALID_RESPONSE_RETRIES = 1;
const TIMEOUT_PATTERN = /timeout|timed out|abort/i;

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini';
  readonly model: string;

  constructor(private readonly config: AppConfig['ai'], private readonly client: GeminiClient, private readonly maxHypotheses: number) {
    this.model = config.geminiModel;
  }

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const attempts = this.config.geminiMaxRetries + 1;
    let invalidResponses = 0;
    let last: VisionProviderError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.requestOnce(input);
      } catch (error) {
        last = this.toProviderError(error, attempt);
        if (last.code === 'invalid_response' && ++invalidResponses > INVALID_RESPONSE_RETRIES) break;
      }
    }
    throw last;
  }

  private async requestOnce(input: VisionInput): Promise<VisionOutput> {
    const response = await this.client.models.generateContent({
      model: this.config.geminiModel,
      contents: [{ role: 'user', parts: this.buildParts(input) }],
      config: {
        systemInstruction: buildSystemInstruction(this.maxHypotheses),
        temperature: this.config.temperature,
        responseMimeType: 'application/json',
        responseSchema: buildVisionResponseSchema(input.allowedDiagnosisCodes),
        httpOptions: { timeout: this.config.geminiTimeoutMs },
      },
    });
    return parseVisionResponse(this.parseJson(response.text), input.allowedDiagnosisCodes, input.photos.length, this.maxHypotheses);
  }

  private parseJson(text: string | undefined): unknown {
    try {
      return JSON.parse(text ?? '');
    } catch {
      throw new InvalidVisionResponseError('response is not valid JSON');
    }
  }

  private buildParts(input: VisionInput) {
    const images = input.photos.map((p) => ({ inlineData: { data: p.bytes.toString('base64'), mimeType: p.mimeType } }));
    return [...images, { text: buildUserPrompt(input) }];
  }

  private toProviderError(error: unknown, attempts: number): VisionProviderError {
    const invalid = error instanceof InvalidVisionResponseError;
    const message = error instanceof Error ? error.message : 'unknown error';
    const code: VisionProviderErrorCode = invalid ? 'invalid_response' : TIMEOUT_PATTERN.test(message) ? 'timeout' : 'request_failed';
    return new VisionProviderError(code, invalid ? message : `Gemini request failed: ${error instanceof Error ? error.name : 'error'}`, attempts);
  }
}
