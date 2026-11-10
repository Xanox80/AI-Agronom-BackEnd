import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshTokenEntity, UserEntity } from '../../../domain/entities';
import { AuthSettings } from '../auth.settings';
import { AccessTokenPayload } from '../auth.types';
import { durationToSeconds } from './duration';

const REFRESH_TOKEN_BYTES = 48;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly settings: AuthSettings,
    @InjectRepository(RefreshTokenEntity) private readonly refreshTokens: Repository<RefreshTokenEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  signAccess(user: UserEntity): { accessToken: string; expiresIn: number } {
    const payload: AccessTokenPayload = { sub: user.id, farmId: user.farmId, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      expiresIn: durationToSeconds(this.settings.auth.jwtExpiresIn),
    };
  }

  async issueRefresh(userId: string): Promise<string> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + this.settings.auth.refreshTokenExpiresDays * MS_PER_DAY);
    await this.refreshTokens.save(this.refreshTokens.create({ userId, tokenHash: hash(raw), expiresAt, revokedAt: null }));
    return raw;
  }

  /** Consumes a refresh token (single use) and returns its active owner. */
  async consumeRefresh(raw: string): Promise<UserEntity> {
    const token = await this.refreshTokens.findOne({ where: { tokenHash: hash(raw), revokedAt: IsNull() } });
    if (!token || token.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Invalid refresh token');
    const claimed = await this.refreshTokens.update({ id: token.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (claimed.affected !== 1) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.users.findOne({ where: { id: token.userId, isActive: true } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return user;
  }

  async revoke(raw: string): Promise<void> {
    await this.refreshTokens.update({ tokenHash: hash(raw), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeAllFor(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}

function hash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
