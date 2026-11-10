import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { compare, hashSync } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from '../../domain/entities';
import { UserDto } from '../../domain/types';
import { IP_LOGIN_ATTEMPTS_MULTIPLIER } from './auth.constants';
import { AuthSettings } from './auth.settings';
import { AuditService } from './audit/audit.service';
import { LoginDto } from './dto/auth.dto';
import { LoginRateLimiter } from './token/login-rate-limiter';
import { TokenService } from './token/token.service';
import { toUserDto } from './users/user.mapper';

const ABSENT_USER_SECRET_BYTES = 16;

export interface LoginResult { accessToken: string; refreshToken: string; expiresIn: number; user: UserDto }
export interface RefreshResult { accessToken: string; refreshToken: string; expiresIn: number }

/** Compared against when the email is unknown so response time does not reveal which accounts exist. */
@Injectable()
export class AuthService {
  private readonly absentUserHash: string;

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly tokens: TokenService,
    private readonly limiter: LoginRateLimiter,
    private readonly audit: AuditService,
    private readonly settings: AuthSettings,
  ) {
    this.absentUserHash = hashSync(randomBytes(ABSENT_USER_SECRET_BYTES).toString('hex'), settings.auth.bcryptRounds);
  }

  async login(dto: LoginDto, ip: string | null): Promise<LoginResult> {
    const email = dto.email.toLowerCase();
    const accountKey = `${email}|${ip ?? ''}`;
    const ipKey = `ip|${ip ?? ''}`;
    this.limiter.assertAllowed(accountKey);
    this.limiter.assertAllowed(ipKey, this.settings.auth.loginMaxAttempts * IP_LOGIN_ATTEMPTS_MULTIPLIER);
    const user = await this.users.findOneBy({ email, isActive: true });
    const passwordMatches = await compare(dto.password, user?.passwordHash ?? this.absentUserHash);
    if (!user || !passwordMatches) {
      this.limiter.recordFailure(accountKey);
      this.limiter.recordFailure(ipKey);
      throw new UnauthorizedException('Invalid credentials');
    }
    this.limiter.reset(accountKey);
    await this.audit.record({ farmId: user.farmId, userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip });
    return { ...this.tokens.signAccess(user), refreshToken: await this.tokens.issueRefresh(user.id), user: toUserDto(user) };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const user = await this.tokens.consumeRefresh(refreshToken);
    return { ...this.tokens.signAccess(user), refreshToken: await this.tokens.issueRefresh(user.id) };
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
