import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth.constants';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const context = { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext;

  it('lets public routes through without a token', () => {
    const reflector = { getAllAndOverride: (key: string) => key === IS_PUBLIC_KEY } as unknown as Reflector;
    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
  });
});
