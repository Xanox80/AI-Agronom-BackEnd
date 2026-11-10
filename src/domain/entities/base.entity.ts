import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @BeforeInsert() assignId(): void {
    this.id ??= randomUUID();
  }
}

export abstract class TenantEntity extends BaseEntity {
  @Index() @Column({ type: 'varchar', length: 36 }) farmId: string;
}

/** Rows created on a device: the client UUID is the row id, so replays are idempotent. */
export abstract class OfflineEntity extends TenantEntity {
  @Column({ type: 'varchar', length: 36, unique: true }) clientId: string;
  @Column({ type: 'datetime', nullable: true }) clientCreatedAt: Date | null;
}

/** Shared provenance columns of every catalogue row (section 2.6). */
export abstract class CatalogEntity extends BaseEntity {
  @Column({ type: 'varchar', default: 'demo_seed' }) source: string;
  @Column({ type: 'varchar', nullable: true }) sourceRef: string | null;
  @Column({ type: 'date', nullable: true }) verifiedAt: string | null;
  @Column({ type: 'boolean', default: true }) isDemo: boolean;
  @Column({ type: 'varchar', nullable: true }) regionCode: string | null;
  @Column({ type: 'int', default: 1 }) version: number;
}
