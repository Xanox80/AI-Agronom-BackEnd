import { settingsStub } from '../__fixtures__/settings.stub';
import { AuditActionResolver } from './audit-action.resolver';

describe('AuditActionResolver', () => {
  const resolver = new AuditActionResolver(settingsStub());

  it.each([
    ['POST', '/api/v1/observations', 'observation.create', 'observation'],
    ['PATCH', '/api/v1/observations/:id', 'observation.update', 'observation'],
    ['DELETE', '/api/v1/tasks/:id', 'task.delete', 'task'],
    ['POST', '/api/v1/recommendations/:id/approve', 'recommendation.approve', 'recommendation'],
    ['PUT', '/api/v1/auto-approve-settings', 'auto-approve-setting.update', 'auto-approve-setting'],
    ['POST', '/api/v1/auth/logout', 'auth.logout', 'auth'],
  ])('maps %s %s to %s', (method, path, action, entityType) => {
    expect(resolver.resolve(method, path)).toEqual({ action, entityType });
  });

  it('works when the route has no api prefix', () => {
    expect(resolver.resolve('POST', '/tasks').action).toBe('task.create');
  });
});
