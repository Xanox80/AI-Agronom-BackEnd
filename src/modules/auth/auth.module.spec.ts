import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { buildConfig } from '../../config/configuration';
import { ALL_ENTITIES } from '../../domain/entities';
import { AuthModule } from './auth.module';
import { DEMO_USERS } from './users/demo-users.seeder';

const DEMO_PASSWORD = 'demo-pass-1';
const env = { NODE_ENV: 'test', DB_PATH: ':memory:', LOGIN_MAX_ATTEMPTS: '3', BCRYPT_ROUNDS: '4', DEMO_USER_PASSWORD: DEMO_PASSWORD };

process.env.DEMO_USER_PASSWORD = DEMO_PASSWORD;

describe('AuthModule', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const login = async (email: string, password = DEMO_PASSWORD) => http().post('/auth/login').send({ email, password });
  const tokenOf = async (email: string) => `Bearer ${(await login(email)).body.accessToken}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => buildConfig(env)] }),
        TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities: ALL_ENTITIES, synchronize: true }),
        EventEmitterModule.forRoot(),
        AuthModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('seeds one demo user per role that can log in with the configured password', async () => {
    for (const demo of DEMO_USERS) {
      const res = await login(demo.email);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: demo.email, role: demo.role, geoCollectionEnabled: true });
      expect(res.body.user.passwordHash).toBeUndefined();
    }
  });

  it('rejects requests without a token', async () => {
    expect((await http().get('/auth/me')).status).toBe(401);
  });

  it('rejects a wrong password and then rate-limits the account', async () => {
    const email = 'ghost@apscout.demo';
    for (let i = 0; i < 3; i++) expect((await login(email, 'wrong-password')).status).toBe(401);
    expect((await login(email, 'wrong-password')).status).toBe(429);
  });

  it('forbids a scout from listing users but lets the chief agronomist do it', async () => {
    expect((await http().get('/users').set('Authorization', await tokenOf('scout@apscout.demo'))).status).toBe(403);
    const res = await http().get('/users').set('Authorization', await tokenOf('chief@apscout.demo'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(DEMO_USERS.length);
  });

  it('lets a user opt out of geolocation collection', async () => {
    const auth = await tokenOf('scout@apscout.demo');
    const res = await http().patch('/auth/me').set('Authorization', auth).send({ geoCollectionEnabled: false, role: 'expert' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ geoCollectionEnabled: false, role: 'scout' });
  });

  it('rotates refresh tokens and revokes them on logout', async () => {
    const { refreshToken } = (await login('expert@apscout.demo')).body;
    const rotated = await http().post('/auth/refresh').send({ refreshToken });
    expect(rotated.status).toBe(200);
    expect((await http().post('/auth/refresh').send({ refreshToken })).status).toBe(401);
    const auth = `Bearer ${rotated.body.accessToken}`;
    expect((await http().post('/auth/logout').set('Authorization', auth).send({ refreshToken: rotated.body.refreshToken })).status).toBe(204);
    expect((await http().post('/auth/refresh').send({ refreshToken: rotated.body.refreshToken })).status).toBe(401);
  });

  it('writes mutating actions to the audit log and hides it from non-chiefs', async () => {
    const chief = await tokenOf('chief@apscout.demo');
    const created = await http().post('/users').set('Authorization', chief)
      .send({ email: 'New.Scout@apscout.demo', password: 'long-enough-1', displayName: 'New Scout', role: 'scout' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ email: 'new.scout@apscout.demo', trustWeight: 1 });

    await new Promise((resolve) => setImmediate(resolve));
    const audit = await http().get('/audit-log?entityType=user').set('Authorization', chief);
    expect(audit.status).toBe(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['user.create', 'auth.login']));
    expect(JSON.stringify(audit.body)).not.toContain('long-enough-1');
    expect((await http().get('/audit-log').set('Authorization', await tokenOf('expert@apscout.demo'))).status).toBe(403);
  });

  it('applies a deactivation immediately to existing access tokens', async () => {
    const chief = await tokenOf('chief@apscout.demo');
    const mechanic = (await login('mechanic@apscout.demo', DEMO_PASSWORD)).body;
    const target = (await http().get('/users').set('Authorization', chief)).body.items.find((u: { email: string }) => u.email === 'mechanic@apscout.demo');
    await http().patch(`/users/${target.id}`).set('Authorization', chief).send({ isActive: false }).expect(200);
    expect((await http().get('/auth/me').set('Authorization', `Bearer ${mechanic.accessToken}`)).status).toBe(401);
  });

  it('returns only the caller farm', async () => {
    const res = await http().get('/farms/me').set('Authorization', await tokenOf('scout@apscout.demo'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'AP Scout Demo Farm', regionCode: 'UA-DEFAULT' });
  });
});
