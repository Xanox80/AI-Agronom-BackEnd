import type { MultiPolygon, Polygon, Position } from 'geojson';

const EARTH_RADIUS_M = 6_371_000;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** Metres from a point to the nearest boundary segment of a contour (local planar approximation, fine at field scale). */
export function distanceToContourMeters(lat: number, lng: number, contour: Polygon | MultiPolygon): number {
  const rings = contour.type === 'Polygon' ? contour.coordinates : contour.coordinates.flat(1);
  const metersPerDegreeLng = EARTH_RADIUS_M * DEGREES_TO_RADIANS * Math.cos(lat * DEGREES_TO_RADIANS);
  const metersPerDegreeLat = EARTH_RADIUS_M * DEGREES_TO_RADIANS;
  const toPlane = ([pLng, pLat]: Position): [number, number] => [(pLng - lng) * metersPerDegreeLng, (pLat - lat) * metersPerDegreeLat];
  let nearest = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      nearest = Math.min(nearest, distanceFromOriginToSegment(toPlane(ring[i - 1]), toPlane(ring[i])));
    }
  }
  return nearest;
}

function distanceFromOriginToSegment([ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
