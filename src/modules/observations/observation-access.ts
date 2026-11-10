import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../../domain/enums';

export interface AuthUser { id: string; farmId: string; role: Role; geoCollectionEnabled?: boolean }

export { Roles } from '../auth/decorators/roles.decorator';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest().user,
);
