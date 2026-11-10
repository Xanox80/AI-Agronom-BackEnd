import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES, FarmEntity, UserEntity } from '../../../domain/entities';
import { Role } from '../../../domain/enums';
import { settingsStub } from '../__fixtures__/settings.stub';
import { AuthSettings } from '../auth.settings';
import { TokenService } from './token.service';

describe('TokenService.consumeRefresh', () => {
  let tokens: TokenService;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities: ALL_ENTITIES, synchronize: true }),
        TypeOrmModule.forFeature(ALL_ENTITIES),
      ],
      providers: [
        TokenService,
        { provide: AuthSettings, useValue: settingsStub() },
        { provide: JwtService, useValue: new JwtService({ secret: 'test-secret' }) },
      ],
    }).compile();
    tokens = moduleRef.get(TokenService);
    const source = moduleRef.get(DataSource);
    const farm = await source.getRepository(FarmEntity).save(source.getRepository(FarmEntity).create({
      name: 'F', regionCode: 'R', timezone: 'UTC', defaultSafetyBuffers: { waterM: 1, apiaryM: 1, settlementM: 1 },
    }));
    const user = await source.getRepository(UserEntity).save(source.getRepository(UserEntity).create({
      farmId: farm.id, email: 'a@b.c', displayName: 'A', role: Role.Scout, passwordHash: 'x', trustWeight: 1,
      locale: 'uk', geoCollectionEnabled: true, isActive: true, regionCode: 'R',
    }));
    userId = user.id;
  });

  it('lets only one of two concurrent consumers use the same token', async () => {
    const raw = await tokens.issueRefresh(userId);
    const results = await Promise.allSettled([tokens.consumeRefresh(raw), tokens.consumeRefresh(raw)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects a token that was already consumed', async () => {
    const raw = await tokens.issueRefresh(userId);
    await tokens.consumeRefresh(raw);
    await expect(tokens.consumeRefresh(raw)).rejects.toThrow('Invalid refresh token');
  });
});
