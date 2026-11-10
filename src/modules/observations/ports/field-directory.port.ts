export interface FieldMatch { fieldId: string; cropId?: string | null }

/** Point-in-polygon lookup provided by the fields module (FR-21). */
export interface FieldDirectory {
  locate(farmId: string, lat: number, lng: number): Promise<FieldMatch[]>;
}

export const FIELD_DIRECTORY = Symbol('FIELD_DIRECTORY');
