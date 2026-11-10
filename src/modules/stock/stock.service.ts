import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Like, Not, Repository } from 'typeorm';
import { ProductEntity, StockItemEntity } from '../../domain/entities';
import { StockSource } from '../../domain/enums';
import { Page } from '../../domain/types';
import { StockImportResultDto, StockItemDto, StockQueryDto, UpsertStockDto } from './dto/stock.dto';
import { parseStockCsv } from './stock-csv.parser';
import { STOCK_PROVIDER, StockAvailability, StockProvider } from './stock-provider';
import { StockSettings } from './stock.settings';

@Injectable()
export class StockService {
  // shortcut: in-process lock only, fine for the single-node SQLite deployment; use a DB constraint when scaling out.
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(StockItemEntity) private readonly items: Repository<StockItemEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @Inject(STOCK_PROVIDER) private readonly provider: StockProvider,
    private readonly settings: StockSettings,
  ) {}

  getAvailability(farmId: string, productIds: string[]): Promise<StockAvailability[]> {
    return this.provider.getStock(farmId, productIds);
  }

  async list(farmId: string, query: StockQueryDto): Promise<Page<StockItemDto>> {
    const pageSize = Math.min(query.pageSize ?? this.settings.defaultPageSize, this.settings.maxPageSize);
    const where: FindOptionsWhere<StockItemEntity> = { farmId };
    if (query.productId) where.productId = query.productId;
    if (query.q) {
      const matches = await this.products.find({ where: { name: Like(`%${query.q}%`) }, select: { id: true } });
      if (!matches.length) return { items: [], total: 0, page: query.page, pageSize };
      where.productId = In(matches.map((p) => p.id));
    }
    const [rows, total] = await this.items.findAndCount({
      where, order: { createdAt: 'ASC' }, skip: (query.page - 1) * pageSize, take: pageSize,
    });
    return { items: await this.toDtos(rows), total, page: query.page, pageSize };
  }

  async upsert(farmId: string, productId: string, dto: UpsertStockDto, source = StockSource.Manual): Promise<StockItemDto> {
    if (!(await this.products.exist({ where: { id: productId } }))) throw new NotFoundException('Product not found');
    const saved = await this.serialized(() => this.saveRow(farmId, productId, dto, source));
    return (await this.toDtos([saved]))[0];
  }

  async remove(farmId: string, id: string): Promise<void> {
    const { affected } = await this.items.delete({ id, farmId });
    if (!affected) throw new NotFoundException('Stock item not found');
  }

  async importCsv(farmId: string, csv: string): Promise<StockImportResultDto> {
    const { rows, rejected } = parseStockCsv(csv);
    const skipped = [...rejected];
    let upserted = 0;
    for (const row of rows) {
      const product = await this.findProduct(row.registrationNumber, row.productName);
      if (!product) { skipped.push({ line: row.line, reason: 'unknown_product' }); continue; }
      try {
        await this.upsert(farmId, product.id, { quantity: row.quantity, unit: row.unit, warehouse: row.warehouse }, StockSource.Csv);
        upserted++;
      } catch (e) {
        if (!(e instanceof BadRequestException)) throw e;
        skipped.push({ line: row.line, reason: 'unit_mismatch' });
      }
    }
    return { upserted, skipped: skipped.sort((a, b) => a.line - b.line) };
  }

  private findProduct(registrationNumber?: string, name?: string): Promise<ProductEntity | null> {
    if (registrationNumber) return this.products.findOne({ where: { registrationNumber } });
    return this.products.findOne({ where: { name } });
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  private async saveRow(farmId: string, productId: string, dto: UpsertStockDto, source: StockSource): Promise<StockItemEntity> {
    const warehouse = dto.warehouse ?? null;
    const lotNumber = dto.lotNumber ?? null;
    // SQLite treats NULLs as distinct in the unique index, so the natural key is matched here.
    const existing = await this.items.findOne({
      where: { farmId, productId, warehouse: warehouse ?? IsNull(), lotNumber: lotNumber ?? IsNull() },
    });
    const otherUnit = await this.items.exist({
      where: { farmId, productId, unit: Not(dto.unit), ...(existing ? { id: Not(existing.id) } : {}) },
    });
    if (otherUnit) throw new BadRequestException('Product is already stocked in a different unit');
    return this.items.save(Object.assign(existing ?? this.items.create({ farmId, productId }), {
      quantity: dto.quantity, unit: dto.unit, warehouse, lotNumber, expiresAt: dto.expiresAt ?? null, source,
    }));
  }

  private async toDtos(rows: StockItemEntity[]): Promise<StockItemDto[]> {
    const ids = [...new Set(rows.map((r) => r.productId))];
    const found = ids.length ? await this.products.find({ where: { id: In(ids) } }) : [];
    const names = new Map(found.map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      id: r.id, productId: r.productId, productName: names.get(r.productId) ?? '', quantity: r.quantity, unit: r.unit,
      warehouse: r.warehouse ?? undefined, lotNumber: r.lotNumber ?? undefined, expiresAt: r.expiresAt ?? undefined,
      source: r.source, syncedAt: r.syncedAt?.toISOString(),
    }));
  }
}
