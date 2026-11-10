import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLogEntity } from '../../../domain/entities';
import { Page } from '../../../domain/types';
import { AuditEntryDto } from '../auth.types';
import { AuditQueryDto } from '../dto/farm-audit.dto';

export interface AuditRecord {
  farmId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ip?: string | null;
  /** Must not contain secrets or personal data. */
  meta?: Record<string, unknown>;
}

/** Append-only audit writer used by every module; reads are tenant-scoped. */
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLogEntity) private readonly entries: Repository<AuditLogEntity>) {}

  async record(entry: AuditRecord): Promise<void> {
    await this.entries.save(this.entries.create({ ...entry, ip: entry.ip ?? null, meta: entry.meta ?? {} }));
  }

  async list(farmId: string, query: AuditQueryDto): Promise<Page<AuditEntryDto>> {
    const where: FindOptionsWhere<AuditLogEntity> = { farmId };
    if (query.userId) where.userId = query.userId;
    if (query.entityType) where.entityType = query.entityType;
    const createdAt = this.createdAtRange(query.from, query.to);
    if (createdAt) where.createdAt = createdAt;
    const [rows, total] = await this.entries.findAndCount({
      where, order: { createdAt: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    return { items: rows.map(toAuditEntryDto), total, page: query.page, pageSize: query.pageSize };
  }

  private createdAtRange(from?: string, to?: string) {
    if (from && to) return Between(new Date(from), new Date(to));
    if (from) return MoreThanOrEqual(new Date(from));
    if (to) return LessThanOrEqual(new Date(to));
    return undefined;
  }
}

function toAuditEntryDto(row: AuditLogEntity): AuditEntryDto {
  return {
    id: row.id, userId: row.userId, action: row.action, entityType: row.entityType, entityId: row.entityId,
    ip: row.ip, meta: row.meta, createdAt: row.createdAt.toISOString(),
  };
}
