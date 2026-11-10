import { BadRequestException } from '@nestjs/common';

export type PulledType = 'fields' | 'tasks' | 'treatments' | 'observations' | 'diagnoses' | 'recommendations';

/** Resumes a paged pull: the frozen upper bound of the window and the last id delivered per entity type. */
export interface PullCursor {
  until: string;
  after: Partial<Record<PulledType, string>>;
}

export const encodeCursor = (cursor: PullCursor): string => Buffer.from(JSON.stringify(cursor)).toString('base64url');

export function decodeCursor(token: string): PullCursor {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as PullCursor;
    if (Number.isNaN(Date.parse(parsed.until)) || typeof parsed.after !== 'object' || parsed.after === null) throw new Error('shape');
    return parsed;
  } catch {
    throw new BadRequestException('invalid pull cursor');
  }
}
