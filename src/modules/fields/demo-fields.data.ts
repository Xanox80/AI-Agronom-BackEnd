import type { Polygon } from 'geojson';

export interface DemoField { name: string; cropCode: string; sowingDate: string; contour: Polygon }

/** Rectangular plots of about 100 ha in Poltava, Kyiv and Vinnytsia oblasts. */
export const DEMO_FIELDS: DemoField[] = [
  {
    name: 'Poltava North', cropCode: 'wheat_winter', sowingDate: '2025-10-01',
    contour: { type: 'Polygon', coordinates: [[[34.5500, 49.6000], [34.5650, 49.6000], [34.5650, 49.6080], [34.5500, 49.6080], [34.5500, 49.6000]]] },
  },
  {
    name: 'Kyiv Meadow', cropCode: 'maize', sowingDate: '2026-04-25',
    contour: { type: 'Polygon', coordinates: [[[30.4000, 50.3000], [30.4180, 50.3000], [30.4180, 50.3070], [30.4000, 50.3070], [30.4000, 50.3000]]] },
  },
  {
    name: 'Vinnytsia South', cropCode: 'sunflower', sowingDate: '2026-04-15',
    contour: { type: 'Polygon', coordinates: [[[28.4500, 49.2000], [28.4640, 49.2000], [28.4640, 49.2090], [28.4500, 49.2090], [28.4500, 49.2000]]] },
  },
];
