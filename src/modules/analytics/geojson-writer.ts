import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { FieldExportDto } from '../../domain/export/export.dto';

export function toFeatureCollection<T extends { externalIds: { scoutId: string } }>(
  items: T[],
  geometryOf: (item: T) => Geometry | null,
): FeatureCollection {
  const features: Feature[] = items.map((item) => {
    const { geometry: _geometry, ...properties } = item as T & { geometry?: unknown };
    return { type: 'Feature', id: item.externalIds.scoutId, geometry: geometryOf(item) as Geometry, properties };
  });
  return { type: 'FeatureCollection', features };
}

export const pointGeometry = (item: { lat: number | null; lng: number | null }): Point | null =>
  item.lat === null || item.lng === null ? null : { type: 'Point', coordinates: [item.lng, item.lat] };

export const fieldGeometry = (field: FieldExportDto): Geometry | null => field.geometry;
