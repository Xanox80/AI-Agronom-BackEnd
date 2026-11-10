import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../domain/enums';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';

/** Restricts a route to the listed roles; without it any authenticated role may call it. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Opts a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
