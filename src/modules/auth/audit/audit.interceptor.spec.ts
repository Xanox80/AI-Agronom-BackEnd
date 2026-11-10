import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { settingsStub } from '../__fixtures__/settings.stub';
import { AuditActionResolver } from './audit-action.resolver';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

function contextWith(req: object): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 201 }) }) } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  const record = jest.fn().mockResolvedValue(undefined);
  const interceptor = new AuditInterceptor({ record } as unknown as AuditService, new AuditActionResolver(settingsStub()));
  const handler = (body: unknown): CallHandler => ({ handle: () => of(body) });
  const user = { id: 'u1', farmId: 'f1' };
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => record.mockClear());

  it('records a successful mutating request without the body', async () => {
    const req = { method: 'POST', route: { path: '/api/v1/observations' }, params: {}, user, ip: '1.2.3.4' };
    await lastValueFrom(interceptor.intercept(contextWith(req), handler({ id: 'o1', secret: 'x' })));
    expect(record).toHaveBeenCalledWith({
      farmId: 'f1', userId: 'u1', action: 'observation.create', entityType: 'observation', entityId: 'o1',
      ip: '1.2.3.4', meta: { method: 'POST', route: '/api/v1/observations', statusCode: 201 },
    });
  });

  it('prefers the route id parameter as entity id', async () => {
    const req = { method: 'PATCH', route: { path: '/api/v1/tasks/:id' }, params: { id: 't9' }, user };
    await lastValueFrom(interceptor.intercept(contextWith(req), handler({ id: 'other' })));
    expect(record.mock.calls[0][0].entityId).toBe('t9');
  });

  it('ignores read requests', async () => {
    const req = { method: 'GET', route: { path: '/api/v1/tasks' }, params: {}, user };
    await lastValueFrom(interceptor.intercept(contextWith(req), handler([])));
    expect(record).not.toHaveBeenCalled();
  });

  it('ignores unauthenticated requests', async () => {
    const req = { method: 'POST', route: { path: '/api/v1/auth/login' }, params: {} };
    await lastValueFrom(interceptor.intercept(contextWith(req), handler({})));
    expect(record).not.toHaveBeenCalled();
  });

  it('does not fail the request when the audit write fails', async () => {
    record.mockRejectedValueOnce(new Error('db down'));
    const req = { method: 'DELETE', route: { path: '/api/v1/tasks/:id' }, params: { id: 't1' }, user };
    await expect(lastValueFrom(interceptor.intercept(contextWith(req), handler(null)))).resolves.toBeNull();
    await flush();
  });
});
