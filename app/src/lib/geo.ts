import { DAYS, LOC } from '../data/itinerary';

export interface View { cx: number; cy: number; zoom: number; w: number; h: number }
export interface ScreenPoint { x: number; y: number }
export interface LonLat { lon: number; lat: number }

// Every pin worth drawing, including waypoints like Death Valley. Used by fitBounds.
export const BASES: { key: string; lon: number; lat: number }[] =
  Object.entries(LOC).map(([key, l]) => ({ key, lon: l.lon, lat: l.lat }));

// Overnight bases in the order the trip actually visits them. Used by the route polyline.
// LOC's key order is not trip order (Canmore comes before Calgary on the ground), and Death
// Valley is a waypoint with no day based there — DAYS is the only reliable source of order.
export const ROUTE: string[] = [...new Set(DAYS.map((d) => d.base))];

// Real trip extent, measured against app/src/data/itinerary.ts on 2026-08-08:
// Canmore (north) to Los Angeles (south), San Francisco (west) to Page (east).
export const TRIP_BOUNDS = { minLon: -122.419, minLat: 34.052, maxLon: -111.456, maxLat: 51.089 };

// Standard web-Mercator tile pixel size at zoom 0 (matches Leaflet/Google Maps conventions).
const TILE_SIZE = 256;
const RAD = Math.PI / 180;

function mercX(lon: number): number {
  return lon * RAD;
}
function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}
function invMercX(x: number): number {
  return x / RAD;
}
function invMercY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
}
function scaleFor(zoom: number): number {
  return (TILE_SIZE * Math.pow(2, zoom)) / (2 * Math.PI);
}

/** Projects a lon/lat coordinate to screen pixels for the given view. Web Mercator, not
 *  equirectangular — the trip spans ~17° of latitude and equirectangular distorts badly
 *  at the northern end (Canmore, 51°). */
export function project(lon: number, lat: number, view: View): ScreenPoint {
  const scale = scaleFor(view.zoom);
  const x = view.w / 2 + (mercX(lon) - mercX(view.cx)) * scale;
  const y = view.h / 2 - (mercY(lat) - mercY(view.cy)) * scale;
  return { x, y };
}

/** Inverse of project(): screen pixels back to lon/lat for the given view. */
export function unproject(x: number, y: number, view: View): LonLat {
  const scale = scaleFor(view.zoom);
  const mx = (x - view.w / 2) / scale + mercX(view.cx);
  const my = -(y - view.h / 2) / scale + mercY(view.cy);
  return { lon: invMercX(mx), lat: invMercY(my) };
}

/** Computes a View that centers and zooms to fit every point within `size`, with padding. */
export function fitBounds(
  points: LonLat[],
  size: { w: number; h: number },
  padding = 24,
): View {
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const mxMin = mercX(minLon);
  const mxMax = mercX(maxLon);
  const myMin = mercY(minLat);
  const myMax = mercY(maxLat);

  const cx = invMercX((mxMin + mxMax) / 2);
  const cy = invMercY((myMin + myMax) / 2);

  const availW = Math.max(size.w - 2 * padding, 1);
  const availH = Math.max(size.h - 2 * padding, 1);
  const spanX = mxMax - mxMin;
  const spanY = myMax - myMin;

  const scaleX = spanX > 0 ? availW / spanX : Infinity;
  const scaleY = spanY > 0 ? availH / spanY : Infinity;
  let scale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(scale)) scale = scaleFor(10); // single point: pick a sane default zoom

  const zoom = Math.log2((scale * 2 * Math.PI) / TILE_SIZE);

  return { cx, cy, zoom, w: size.w, h: size.h };
}
