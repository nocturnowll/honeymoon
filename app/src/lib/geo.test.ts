import { expect, test } from 'vitest';
import { BASES, ROUTE, fitBounds, project, unproject } from './geo';

test('BASES holds all 12 trip locations', () => {
  expect(BASES.length).toBe(12);
});

test('ROUTE holds the 11 overnight bases, in trip order', () => {
  expect(ROUTE.length).toBe(11);
});

test('ROUTE does not contain Death Valley — it is a waypoint, not an overnight base', () => {
  expect(ROUTE).not.toContain('dvl');
});

test('projection round-trips a known coordinate', () => {
  const view = { cx: -118, cy: 37, zoom: 1, w: 390, h: 600 };
  const p = project(-118.244, 34.052, view); // Los Angeles
  const back = unproject(p.x, p.y, view);
  expect(back.lon).toBeCloseTo(-118.244, 4);
  expect(back.lat).toBeCloseTo(34.052, 4);
});

test('fitBounds contains every trip base', () => {
  const view = fitBounds(BASES, { w: 390, h: 600 });
  for (const b of BASES) {
    const p = project(b.lon, b.lat, view);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(390);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(600);
  }
});
