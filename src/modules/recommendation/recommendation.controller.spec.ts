import { ROLES_KEY } from '../auth/auth.constants';
import { Role } from '../../domain/enums';
import { RecommendationController } from './recommendation.controller';

const rolesOf = (method: keyof RecommendationController): Role[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, RecommendationController.prototype[method]);

describe('RecommendationController role guards', () => {
  it('lets only the chief agronomist approve and reject', () => {
    expect(rolesOf('approve')).toEqual([Role.ChiefAgronomist]);
    expect(rolesOf('reject')).toEqual([Role.ChiefAgronomist]);
  });

  it('lets scouts and the chief agronomist create and recompute', () => {
    expect(rolesOf('create')).toEqual([Role.Scout, Role.ChiefAgronomist]);
    expect(rolesOf('recompute')).toEqual([Role.Scout, Role.ChiefAgronomist]);
  });

  it('leaves reads open to any authenticated role', () => {
    expect(rolesOf('get')).toBeUndefined();
    expect(rolesOf('listForObservation')).toBeUndefined();
  });

  it('passes the approver and the language to the service', async () => {
    const service = { approve: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) };
    const controller = new RecommendationController(service as never);
    const user = { id: 'u', farmId: 'f' } as never;
    await controller.approve(user, 'rec-1', '1.1.1.1');
    await controller.create(user, { observationId: 'o' }, '1.1.1.1', 'en-US,en');
    expect(service.approve).toHaveBeenCalledWith(user, 'rec-1', { ip: '1.1.1.1' });
    expect(service.create).toHaveBeenCalledWith(user, { observationId: 'o' }, { ip: '1.1.1.1', locale: 'en' });
  });
});
