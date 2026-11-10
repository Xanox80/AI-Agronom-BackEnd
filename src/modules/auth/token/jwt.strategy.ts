import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities';
import { AuthSettings } from '../auth.settings';
import { JWT_STRATEGY } from '../auth.constants';
import { AccessTokenPayload, AuthUser } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  constructor(settings: AuthSettings, @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: settings.auth.jwtSecret,
      ignoreExpiration: false,
    });
  }

  /** Reloads the user so deactivation and role changes apply before the token expires. */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.users.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, farmId: user.farmId, role: user.role, email: user.email, geoCollectionEnabled: user.geoCollectionEnabled };
  }
}
