import { Column, Entity, Index } from 'typeorm';
import { Role } from '../enums';
import { BaseEntity, TenantEntity } from './base.entity';

@Entity('farms')
export class FarmEntity extends BaseEntity {
  @Column() name: string;
  @Column() regionCode: string;
  @Column() timezone: string;
  @Column({ type: 'simple-json' }) defaultSafetyBuffers: { waterM: number; apiaryM: number; settlementM: number };
}

@Entity('users')
export class UserEntity extends TenantEntity {
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column() displayName: string;
  @Column({ type: 'varchar' }) role: Role;
  @Column({ type: 'float' }) trustWeight: number;
  @Column({ type: 'varchar', length: 5, default: 'uk' }) locale: string;
  @Column({ type: 'boolean', default: true }) geoCollectionEnabled: boolean;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'varchar', nullable: true }) regionCode: string | null;
}

@Entity('refresh_tokens')
export class RefreshTokenEntity extends BaseEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column() tokenHash: string;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
}
