import { ROLES_KEY } from '../auth/auth.constants';
import { Role } from '../../domain/enums';
import { AutoApproveController } from './auto-approve.controller';

describe('AutoApproveController role guards', () => {
  it('restricts every auto-approve route to the chief agronomist', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AutoApproveController)).toEqual([Role.ChiefAgronomist]);
  });
});
