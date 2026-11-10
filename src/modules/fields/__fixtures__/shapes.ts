import type { Polygon } from 'geojson';

/** Roughly 1 km x 1 km square near Kyiv (about 100 ha). */
export const SQUARE: Polygon = {
  type: 'Polygon',
  coordinates: [[[30.0, 50.0], [30.0, 50.009], [30.014, 50.009], [30.014, 50.0], [30.0, 50.0]]],
};

export const SQUARE_CENTRE = { lat: 50.0045, lng: 30.007 };
