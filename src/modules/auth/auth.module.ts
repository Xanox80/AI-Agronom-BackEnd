import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity, FarmEntity, RefreshTokenEntity, AuditLogEntity } from '../../domain/entities';
import { AuditActionResolver } from './audit/audit-action.resolver';
import { AuditController } from './audit/audit.controller';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSettings } from './auth.settings';
import { FarmsController } from './farms/farms.controller';
import { FarmsService } from './farms/farms.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './token/jwt.strategy';
import { LoginRateLimiter } from './token/login-rate-limiter';
import { TokenService } from './token/token.service';
import { DemoUsersSeeder } from './users/demo-users.seeder';
import { TrustWeightResolver } from './users/trust-weight.resolver';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/** Global so every module gets `AuditService`; JWT and role guards plus the audit interceptor apply app-wide. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, FarmEntity, RefreshTokenEntity, AuditLogEntity]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { jwtSecret, jwtExpiresIn } = config.getOrThrow('auth');
        return { secret: jwtSecret, signOptions: { expiresIn: jwtExpiresIn } };
      },
    }),
  ],
  controllers: [AuthController, UsersController, FarmsController, AuditController],
  providers: [
    AuthSettings, AuthService, TokenService, LoginRateLimiter, JwtStrategy, UsersService, TrustWeightResolver,
    FarmsService, AuditService, AuditActionResolver, DemoUsersSeeder,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService, AuthSettings],
})
export class AuthModule {}
