export interface StockAvailability {
  productId: string;
  inStock: boolean;
  quantity: number;
  unit: string | null;
}

/** Source of stock levels: the local table now, an AP Storage/ERP connector later. */
export interface StockProvider {
  getStock(farmId: string, productIds: string[]): Promise<StockAvailability[]>;
}

export const STOCK_PROVIDER = Symbol('STOCK_PROVIDER');
