import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { IsNull, Not, Repository } from 'typeorm';
import { FieldEntity } from '../../domain/entities';
import { distanceToContourMeters } from './contour-distance';
import { FieldCandidate, LocateResult } from './dto/field-geo.dto';
import { FieldsSettings } from './fields.settings';

/** Resolves the field for a GPS point (FR-21): containing fields first, nearest candidates as a fallback. */
@Injectable()
export class FieldLocatorService {
  constructor(
    @InjectRepository(FieldEntity) private readonly fields: Repository<FieldEntity>,
    private readonly settings: FieldsSettings,
  ) {}

  async locate(farmId: string, lat: number, lng: number): Promise<LocateResult> {
    const candidates = await this.fields.find({ where: { farmId, deletedAt: IsNull(), contour: Not(IsNull()) } });
    const matches = candidates.filter((field) => this.contains(field, lat, lng)).map((field) => ({ fieldId: field.id, name: field.name }));
    return { matches, nearby: matches.length ? [] : this.nearest(candidates, lat, lng) };
  }

  private contains(field: FieldEntity, lat: number, lng: number): boolean {
    const [minLng, minLat, maxLng, maxLat] = field.bbox ?? [-Infinity, -Infinity, Infinity, Infinity];
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
    return booleanPointInPolygon([lng, lat], field.contour as unknown as Feature<Polygon | MultiPolygon>);
  }

  private nearest(fields: FieldEntity[], lat: number, lng: number): FieldCandidate[] {
    return fields
      .map((field) => ({ fieldId: field.id, name: field.name, distanceM: distanceToContourMeters(lat, lng, field.contour as Polygon | MultiPolygon) }))
      .filter((candidate) => candidate.distanceM <= this.settings.nearbyMaxMeters)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, this.settings.nearbyLimit)
      .map((candidate) => ({ ...candidate, distanceM: Math.round(candidate.distanceM) }));
  }
}
