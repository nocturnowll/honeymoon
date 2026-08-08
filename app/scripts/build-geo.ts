#!/usr/bin/env bun
/**
 * Builds app/src/data/geo/*.json from Natural Earth's public-domain 1:50m
 * coastline and admin-1 (state/province) boundary lines.
 *
 * Source: https://github.com/nvkelso/natural-earth-vector (public domain)
 *
 * Raw downloads are cached under the OS temp dir, never inside the repo.
 * Only the clipped, simplified, rounded output is written to src/data/geo/
 * and that is the only thing meant to be committed.
 *
 * Run: bun run scripts/build-geo.ts
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type Point = [number, number]; // [lon, lat]

const SOURCES: Record<string, string> = {
  coastline: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson',
  borders: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson',
};

// Trip bbox with padding on every side of the real extent (lon -122.419..-111.456, lat 34.052..51.089).
const BBOX = { minLon: -124, minLat: 33, maxLon: -110, maxLat: 52 };

// Douglas-Peucker tolerance in degrees. Tuned by eye against the 200KB target.
const TOLERANCE_DEG = 0.0005;

const OUT_DIR = path.resolve(import.meta.dirname, '../src/data/geo');
const CACHE_DIR = path.join(os.tmpdir(), 'larch-canyon-geo-cache');

// ---- fetch + cache (outside the repo) ----

async function fetchCached(name: string, url: string): Promise<any> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${name}.geojson`);
  if (!existsSync(file)) {
    console.log(`Fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    await writeFile(file, await res.text());
  } else {
    console.log(`Using cached ${file}`);
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

// ---- bbox clipping (Liang-Barsky segment clip, chained into linestrings) ----

function clipSegment(p0: Point, p1: Point): [Point, Point] | null {
  const [x0, y0] = p0;
  const dx = p1[0] - x0;
  const dy = p1[1] - y0;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, x0 - BBOX.minLon],
    [dx, BBOX.maxLon - x0],
    [-dy, y0 - BBOX.minLat],
    [dy, BBOX.maxLat - y0],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null; // parallel to this edge and entirely outside it
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    [x0 + t0 * dx, y0 + t0 * dy],
    [x0 + t1 * dx, y0 + t1 * dy],
  ];
}

/** Clips a linestring to BBOX, truncating at the boundary and splitting into
 *  multiple pieces wherever the line leaves and re-enters the box. */
function clipLineString(coords: Point[]): Point[][] {
  const out: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const clipped = clipSegment(coords[i], coords[i + 1]);
    if (!clipped) {
      if (current.length >= 2) out.push(current);
      current = [];
      continue;
    }
    const [a, b] = clipped;
    if (current.length === 0) {
      current.push(a, b);
    } else {
      const last = current[current.length - 1];
      if (last[0] === a[0] && last[1] === a[1]) {
        current.push(b);
      } else {
        if (current.length >= 2) out.push(current);
        current = [a, b];
      }
    }
  }
  if (current.length >= 2) out.push(current);
  return out;
}

// ---- Douglas-Peucker simplification ----

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.hypot(p[0] - projX, p[1] - projY);
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, index + 1), tolerance);
    const right = simplify(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

function round4(p: Point): Point {
  return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000];
}

// ---- pipeline ----

function reduceGeometry(geom: { type: string; coordinates: any }): Point[][] {
  const lines: Point[][] = geom.type === 'LineString'
    ? [geom.coordinates]
    : geom.type === 'MultiLineString'
      ? geom.coordinates
      : [];
  const result: Point[][] = [];
  for (const line of lines) {
    for (const piece of clipLineString(line)) {
      const simplified = simplify(piece, TOLERANCE_DEG);
      if (simplified.length >= 2) result.push(simplified.map(round4));
    }
  }
  return result;
}

function reduceFeatureCollection(fc: { features: any[] }) {
  const features: any[] = [];
  for (const f of fc.features) {
    for (const coordinates of reduceGeometry(f.geometry)) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
    }
  }
  return { type: 'FeatureCollection', features };
}

async function build(name: string, url: string) {
  const raw = await fetchCached(name, url);
  const reduced = reduceFeatureCollection(raw);
  const json = JSON.stringify(reduced);
  await writeFile(path.join(OUT_DIR, `${name}.json`), json);
  console.log(`${name}: ${raw.features.length} -> ${reduced.features.length} features, ${json.length} bytes`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await build('coastline', SOURCES.coastline);
  await build('borders', SOURCES.borders);
  console.log('Roads dropped: ne_10m_roads.geojson is ~50MB raw (only published at 1:10m, per the plan); not worth it for this map.');
}

main();
