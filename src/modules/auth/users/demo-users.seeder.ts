import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { DEMO_FARM_SEEDED } from '../../../domain/demo-events';
import { FarmEntity, UserEntity } from '../../../domain/entities';
import { Role } from '../../../domain/enums';
import { DEFAULT_LOCALE } from '../auth.constants';
import { AuthSettings } from '../auth.settings';
import { TrustWeightResolver } from './trust-weight.resolver';
import { UsersService } from './users.service';

const DEMO_TIMEZONE = 'Europe/Kyiv';

export const DEMO_USERS: { email: string; displayName: string; role: Role }[] = [
  { email: 'scout@apscout.demo', displayName: 'Demo Scout', role: Role.Scout },
  { email: 'chief@apscout.demo', displayName: 'Demo Chief Agronomist', role: Role.ChiefAgronomist },
  { email: 'mechanic@apscout.demo', displayName: 'Demo Mechanic', role: Role.Mechanic },
  { email: 'expert@apscout.demo', displayName: 'Demo Expert', role: Role.Expert },
];

/** Seeds one demo farm with a user per role on first boot; the password comes from configuration. */
@Injectable()
export class DemoUsersSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoUsersSeeder.name);

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(FarmEntity) private readonly farms: Repository<FarmEntity>,
    private readonly settings: AuthSettings,
    private readonly trustWeights: TrustWeightResolver,
    private readonly usersService: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.settings.seedDemoUsers || (await this.users.count()) > 0) return;
    const { waterBufferM, apiaryBufferM, settlementBufferM } = this.settings.safetyBuffers;
    const farm = await this.farms.save(this.farms.create({
      name: this.settings.demoFarmName, regionCode: this.settings.defaultRegion, timezone: DEMO_TIMEZONE,
      defaultSafetyBuffers: { waterM: waterBufferM, apiaryM: apiaryBufferM, settlementM: settlementBufferM },
    }));
    const passwordHash = await this.usersService.hashPassword(this.settings.demoPassword);
    await this.users.save(DEMO_USERS.map((demo) => this.users.create({
      ...demo, farmId: farm.id, passwordHash, trustWeight: this.trustWeights.forRole(demo.role),
      locale: DEFAULT_LOCALE, geoCollectionEnabled: true, isActive: true, regionCode: farm.regionCode,
    })));
    await this.events.emitAsync(DEMO_FARM_SEEDED, { farmId: farm.id });
    this.logger.log(`Seeded ${DEMO_USERS.length} demo users`);
  }
}
