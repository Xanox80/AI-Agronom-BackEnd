import { Role } from '../../../domain/enums';
import { settingsStub } from '../__fixtures__/settings.stub';
import { TrustWeightResolver } from './trust-weight.resolver';

describe('TrustWeightResolver', () => {
  const resolver = new TrustWeightResolver(settingsStub());

  it.each([[Role.Expert, 3], [Role.ChiefAgronomist, 2], [Role.Scout, 1], [Role.Mechanic, 0.5]])(
    'returns the configured weight for %s', (role, weight) => {
      expect(resolver.forRole(role)).toBe(weight);
    },
  );
});
