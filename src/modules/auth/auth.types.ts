import { Role } from '../../domain/enums';

/** The authenticated principal attached to `request.user`; `farmId` is the tenant key. */
export interface AuthUser {
  id: string;
  farmId: string;
  role: Role;
  email: string;
  geoCollectionEnabled?: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  farmId: string;
  role: Role;
}

export interface AuditEntryDto {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ip: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}
