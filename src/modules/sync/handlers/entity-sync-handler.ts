import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role, SyncEntityType, SyncStatus } from '../../../domain/enums';

/** The authenticated caller as placed on the request by be-auth. */
export interface SyncActor { userId: string; farmId: string; role: Role }

/** `clockSkewMs` is the tolerated difference between a device clock and the server clock. */
export interface SyncContext extends SyncActor { deviceId: string; clockSkewMs: number }

export interface SyncChange { clientId: string; clientTimestamp: Date; payload: Record<string, unknown> }

export interface HandlerOutcome { status: SyncStatus.Applied | SyncStatus.Conflict; serverId: string }

/** One implementation per pushed entity type; the sync service dispatches by `entityType`. */
export interface EntitySyncHandler {
  readonly entityType: SyncEntityType;
  readonly roles: readonly Role[];
  /** `lastOwnWriteAt` is the client time of this device's last applied write, used for last-writer-wins. */
  upsert(ctx: SyncContext, change: SyncChange, lastOwnWriteAt: Date | null): Promise<HandlerOutcome>;
  remove(ctx: SyncContext, change: SyncChange): Promise<HandlerOutcome>;
}

export const SYNC_HANDLERS = Symbol('SYNC_HANDLERS');

export async function validatePayload<P extends object>(payloadClass: new () => P, payload: unknown): Promise<P> {
  const instance = plainToInstance(payloadClass, payload);
  const errors = await validate(instance, { whitelist: true, forbidUnknownValues: true });
  if (errors.length > 0) {
    throw new BadRequestException(`invalid payload: ${errors.map((e) => e.property).join(', ')}`);
  }
  return instance;
}

export function optionalDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

const DATE_ONLY_LENGTH = 10;

export function dateOnly(value: string): string {
  return value.slice(0, DATE_ONLY_LENGTH);
}
