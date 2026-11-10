import { Role } from '../../domain/enums';

export interface ExpertRequest { user: { id: string; farmId: string; role: Role } }

/** Experts see every farm; a chief agronomist only their own. */
export const farmScope = ({ user }: ExpertRequest): string | undefined => (user.role === Role.Expert ? undefined : user.farmId);
