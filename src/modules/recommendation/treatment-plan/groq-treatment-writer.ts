import { buildTreatmentSystemPrompt, buildTreatmentUserPrompt } from './treatment-prompt.builder';
import { TreatmentPlanSettings } from './treatment-plan.settings';
import { TreatmentFacts } from './treatment-plan.types';

export const TREATMENT_WRITER = Symbol('TREATMENT_WRITER');

/** Drafts a treatment course from registry facts; the answer is unchecked JSON until the validator has seen it. */
export interface TreatmentWriter {
  readonly model: string;
  write(facts: TreatmentFacts): Promise<unknown>;
}

/** The slice of the groq-sdk client this writer needs; lets tests inject a fake. */
export interface GroqChatClient {
  chat: { completions: { create(body: unknown, options?: { timeout?: number }): Promise<{ choices: { message?: { content?: string | null } }[] }> } };
}

export class TreatmentWriterError extends Error {}

/** Groq text model in JSON mode; it never sees photos, only the facts the rules engine already established. */
export class GroqTreatmentWriter implements TreatmentWriter {
  readonly model: string;

  constructor(private readonly settings: TreatmentPlanSettings, private readonly client: GroqChatClient) {
    this.model = settings.model;
  }

  async write(facts: TreatmentFacts): Promise<unknown> {
    let content: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: this.settings.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildTreatmentSystemPrompt() },
          { role: 'user', content: buildTreatmentUserPrompt(facts) },
        ],
      }, { timeout: this.settings.timeoutMs });
      content = completion.choices[0]?.message?.content;
    } catch (error) {
      throw new TreatmentWriterError(`Groq request failed: ${(error as Error).message}`);
    }
    if (!content) throw new TreatmentWriterError('Groq returned an empty answer');
    try {
      return JSON.parse(content);
    } catch {
      throw new TreatmentWriterError('Groq answer is not valid JSON');
    }
  }
}
