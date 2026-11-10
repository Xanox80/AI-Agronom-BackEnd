import { BadRequestException } from '@nestjs/common';
import type { AffectedRegion } from '../../domain/types';

const RECT_POINT_COUNT = 2;
const MIN_POLYGON_POINTS = 3;

const inUnitRange = (value: number): boolean => value >= 0 && value <= 1;

/** Normalised (0..1) lesion region: a rect is two corners, a polygon needs at least three vertices. */
export function assertValidRegion(region: AffectedRegion): void {
  const { type, points } = region;
  if (!points.every((p) => inUnitRange(p.x) && inUnitRange(p.y))) {
    throw new BadRequestException('Region coordinates must be normalised to 0..1');
  }
  const countOk = type === 'rect' ? points.length === RECT_POINT_COUNT : points.length >= MIN_POLYGON_POINTS;
  if (!countOk) throw new BadRequestException(`Region of type ${type} has an invalid number of points`);
}
