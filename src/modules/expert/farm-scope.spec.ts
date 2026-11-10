import { Role } from '../../domain/enums';
import { farmScope } from './farm-scope';

describe('farmScope', () => {
  it('is unrestricted for experts', () => {
    expect(farmScope({ user: { id: 'u', farmId: 'f1', role: Role.Expert } })).toBeUndefined();
  });

  it('limits a chief agronomist to their own farm', () => {
    expect(farmScope({ user: { id: 'u', farmId: 'f1', role: Role.ChiefAgronomist } })).toBe('f1');
  });
});
