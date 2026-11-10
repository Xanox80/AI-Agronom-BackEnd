import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../domain/enums';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';
import { RolesGuard } from './roles.guard';

function contextWith(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined, getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(metadata: Record<string, unknown>): RolesGuard {
  const reflector = { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    expect(guardWith({}).canActivate(contextWith({ role: Role.Mechanic }))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    const guard = guardWith({ [ROLES_KEY]: [Role.ChiefAgronomist, Role.Expert] });
    expect(guard.canActivate(contextWith({ role: Role.Expert }))).toBe(true);
  });

  it('forbids a user whose role is not listed', () => {
    const guard = guardWith({ [ROLES_KEY]: [Role.ChiefAgronomist] });
    expect(() => guard.canActivate(contextWith({ role: Role.Scout }))).toThrow(ForbiddenException);
  });

  it('forbids when roles are required and there is no user', () => {
    const guard = guardWith({ [ROLES_KEY]: [Role.Scout] });
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
  });

  it('skips the check for public routes', () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: [Role.Scout] });
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });
});
