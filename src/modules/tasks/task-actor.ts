import { Role } from '../../domain/enums';

/** The authenticated caller (AuthUser) as placed on the request by the auth module. */
export interface TaskActor { id: string; farmId: string; role: Role }
