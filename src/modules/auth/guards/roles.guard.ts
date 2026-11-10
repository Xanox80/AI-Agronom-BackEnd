import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../domain/enums';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
