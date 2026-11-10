import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app-config';
import { Role } from '../../domain/enums';
import { UserEntity } from '../../domain/entities';
import { LabelSource } from '../../domain/enums';

@Injectable()
export class LabelWeightService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** A per-user weight (set at creation or by the chief agronomist, 0 mutes the labeller) beats the role default. */
  weightFor(user: Pick<UserEntity, 'role' | 'trustWeight'>): number {
    return user.trustWeight ?? this.roleWeight(user.role);
  }

  sourceFor(role: Role): LabelSource {
    return role === Role.Expert ? LabelSource.Expert : LabelSource.User;
  }

  private roleWeight(role: Role): number {
    const weights = this.config.get('auth', { infer: true }).trustWeights;
    const byRole: Record<Role, number> = {
      [Role.Expert]: weights.expert, [Role.ChiefAgronomist]: weights.chief,
      [Role.Scout]: weights.scout, [Role.Mechanic]: weights.mechanic,
    };
    return byRole[role];
  }
}
