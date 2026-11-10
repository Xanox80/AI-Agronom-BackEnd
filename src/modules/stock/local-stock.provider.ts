import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Or, Repository } from 'typeorm';
import { StockItemEntity } from '../../domain/entities';
import { StockAvailability, StockProvider } from './stock-provider';

/** Sums non-expired lots in the unit of the product's first row; rows in other units are ignored (writes reject them). */
@Injectable()
export class LocalStockProvider implements StockProvider {
  constructor(@InjectRepository(StockItemEntity) private readonly items: Repository<StockItemEntity>) {}

  async getStock(farmId: string, productIds: string[]): Promise<StockAvailability[]> {
    if (!productIds.length) return [];
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.items.find({
      where: { farmId, productId: In(productIds), expiresAt: Or(IsNull(), MoreThanOrEqual(today)) },
      order: { createdAt: 'ASC' },
    });
    return productIds.map((productId) => {
      const own = rows.filter((r) => r.productId === productId);
      const unit = own[0]?.unit ?? null;
      const quantity = own.filter((r) => r.unit === unit).reduce((sum, r) => sum + r.quantity, 0);
      return { productId, inStock: quantity > 0, quantity, unit };
    });
  }
}
