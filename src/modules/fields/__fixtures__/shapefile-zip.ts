import { zipSync } from 'fflate';

const SHP_HEADER_BYTES = 100;
const SHP_FILE_CODE = 9994;
const SHP_VERSION = 1000;
const SHP_POLYGON_TYPE = 5;
const RECORD_HEADER_BYTES = 8;
const BOUNDS_OFFSET = 4;
const PART_COUNT_OFFSET = 36;
const POINT_COUNT_OFFSET = 40;
const POINTS_OFFSET = 48;
const BYTES_PER_POINT = 16;

/** Builds a zipped one-polygon shapefile (.shp only) by hand so import tests run against a real archive. */
export function polygonShapefileZip(ring: number[][]): Buffer {
  const bounds = [
    Math.min(...ring.map((p) => p[0])), Math.min(...ring.map((p) => p[1])),
    Math.max(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[1])),
  ];
  const content = Buffer.alloc(POINTS_OFFSET + ring.length * BYTES_PER_POINT);
  content.writeInt32LE(SHP_POLYGON_TYPE, 0);
  bounds.forEach((value, i) => content.writeDoubleLE(value, BOUNDS_OFFSET + i * 8));
  content.writeInt32LE(1, PART_COUNT_OFFSET);
  content.writeInt32LE(ring.length, POINT_COUNT_OFFSET);
  content.writeInt32LE(0, POINT_COUNT_OFFSET + 4);
  ring.forEach(([x, y], i) => {
    content.writeDoubleLE(x, POINTS_OFFSET + i * BYTES_PER_POINT);
    content.writeDoubleLE(y, POINTS_OFFSET + i * BYTES_PER_POINT + 8);
  });
  const shp = Buffer.alloc(SHP_HEADER_BYTES + RECORD_HEADER_BYTES + content.length);
  shp.writeInt32BE(SHP_FILE_CODE, 0);
  shp.writeInt32BE(shp.length / 2, 24);
  shp.writeInt32LE(SHP_VERSION, 28);
  shp.writeInt32LE(SHP_POLYGON_TYPE, 32);
  bounds.forEach((value, i) => shp.writeDoubleLE(value, 36 + i * 8));
  shp.writeInt32BE(1, SHP_HEADER_BYTES);
  shp.writeInt32BE(content.length / 2, SHP_HEADER_BYTES + 4);
  content.copy(shp, SHP_HEADER_BYTES + RECORD_HEADER_BYTES);
  return Buffer.from(zipSync({ 'fields.shp': new Uint8Array(shp) }));
}
