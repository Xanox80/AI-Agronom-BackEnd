import { Injectable } from '@nestjs/common';
import { Role } from '../../../domain/enums';
import { AuthSettings } from '../auth.settings';

/** Default FR-29 label weight for a role, from configuration. */
@Injectable()
export class TrustWeightResolver {
  constructor(private readonly settings: AuthSettings) {}

  forRole(role: Role): number {
    const { trustWeights } = this.settings.auth;
    const byRole: Record<Role, number> = {
      [Role.Expert]: trustWeights.expert,
      [Role.ChiefAgronomist]: trustWeights.chief,
      [Role.Scout]: trustWeights.scout,
      [Role.Mechanic]: trustWeights.mechanic,
    };
    return byRole[role];
  }
}
