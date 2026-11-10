import { BadRequestException, Injectable } from '@nestjs/common';
import area from '@turf/area';
import type { Geometry, MultiPolygon, Polygon } from 'geojson';

export type FieldBbox = [number, number, number, number];

export interface FieldShape {
  contour: Polygon | MultiPolygon;
  areaHa: number;
  bbox: FieldBbox;
  centroid: { lat: number; lng: number };
}

const SQUARE_METERS_PER_HECTARE = 10_000;
const AREA_PRECISION = 100;
const MIN_RING_POSITIONS = 4;
const MAX_ABS_LNG = 180;
const MAX_ABS_LAT = 90;
const PLANAR_POSITION_LENGTH = 2;
const POSITION_WITH_ALTITUDE_LENGTH = 3;

/** Validates field contours and derives area, bounding box and centroid from them. */
@Injectable()
export class FieldGeometryService {
  describe(geometry: unknown): FieldShape {
    if (!this.isPolygonal(geometry)) {
      throw new BadRequestException({
        code: 'FIELD_CONTOUR_INVALID',
        message: ['contour must be a closed GeoJSON Polygon or MultiPolygon with WGS84 coordinates'],
      });
    }
    const contour = { type: geometry.type, coordinates: dropAltitude(geometry.coordinates) } as Polygon | MultiPolygon;
    const bbox = bboxOf(contour);
    return {
      contour,
      bbox,
      // shortcut: bbox centre instead of the polygon centroid, upgrade if very concave fields misplace the map pin
      centroid: { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 },
      areaHa: Math.round((area(contour) / SQUARE_METERS_PER_HECTARE) * AREA_PRECISION) / AREA_PRECISION,
    };
  }

  isPolygonal(geometry: unknown): geometry is Polygon | MultiPolygon {
    const candidate = geometry as { type?: string; coordinates?: unknown } | null;
    if (candidate?.type === 'Polygon') return isPolygon(candidate.coordinates);
    if (candidate?.type === 'MultiPolygon') {
      return Array.isArray(candidate.coordinates) && candidate.coordinates.length > 0 && candidate.coordinates.every(isPolygon);
    }
    return false;
  }
}

function isPolygon(rings: unknown): boolean {
  return Array.isArray(rings) && rings.length > 0 && rings.every(isClosedRing);
}

function isClosedRing(ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < MIN_RING_POSITIONS || !ring.every(isPosition)) return false;
  const first = ring[0] as number[];
  const last = ring[ring.length - 1] as number[];
  return first[0] === last[0] && first[1] === last[1];
}

function isPosition(position: unknown): boolean {
  if (!Array.isArray(position)) return false;
  if (position.length !== PLANAR_POSITION_LENGTH && position.length !== POSITION_WITH_ALTITUDE_LENGTH) return false;
  if (!position.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  return Math.abs(position[0]) <= MAX_ABS_LNG && Math.abs(position[1]) <= MAX_ABS_LAT;
}

function dropAltitude(coordinates: unknown): unknown {
  const list = coordinates as unknown[];
  return typeof list[0] === 'number' ? list.slice(0, PLANAR_POSITION_LENGTH) : list.map(dropAltitude);
}

function bboxOf(geometry: Geometry & { coordinates: unknown }): FieldBbox {
  const depth = geometry.type === 'Polygon' ? 2 : 3;
  const positions = (geometry.coordinates as unknown[]).flat(depth - 1) as number[][];
  const lngs = positions.map((p) => p[0]);
  const lats = positions.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
