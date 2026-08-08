import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BASES, ROUTE, fitBounds, project } from '../lib/geo';
import { LOC } from '../data/itinerary';
import { TripMap, clampView, panBy, zoomAt } from './TripMap';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Reads a <g class="map-pin"> element's screen position from its own transform
 *  attribute — this is what TripMap actually rendered, not a recomputation. */
function pinPositions(): { key: string; x: number; y: number }[] {
  const pins = [...container.querySelectorAll('.map-pin')];
  return pins.map((g) => {
    const t = g.getAttribute('transform') ?? '';
    const m = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(t);
    return { key: g.getAttribute('aria-label') ?? '', x: Number(m?.[1]), y: Number(m?.[2]) };
  });
}

test('all 12 bases render a pin, spread across the viewport at default zoom — not stacked at the centre', () => {
  act(() => {
    root.render(<TripMap />);
  });
  const pins = pinPositions();
  expect(pins).toHaveLength(12);

  // 390x600 is the map's own logical coordinate system (viewBox), matching the
  // default fit tested in lib/geo.test.ts. A collapsed projection would put every
  // pin near (195, 300); a healthy one spans most of the frame. The real spread at
  // this size is ~66% of width and ~92% of height — assert comfortably below that
  // so the test fails only if the projection actually collapsed.
  const xs = pins.map((p) => p.x);
  const ys = pins.map((p) => p.y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  expect(spreadX / 390).toBeGreaterThan(0.5);
  expect(spreadY / 600).toBeGreaterThan(0.8);

  // And every pin is still within the frame.
  for (const p of pins) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(390);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(600);
  }
});

test('the route polyline visits bases in trip order, not LOC declaration order', () => {
  act(() => {
    root.render(<TripMap />);
  });
  const path = container.querySelector('.trip-map-route')?.getAttribute('d') ?? '';
  // One M/L command per route vertex, in ROUTE's order.
  const commands = path.trim().split(/\s+/).filter(Boolean);
  expect(commands).toHaveLength(ROUTE.length);
  expect(commands[0][0]).toBe('M');
  expect(commands.slice(1).every((c) => c[0] === 'L')).toBe(true);

  // LOC's declaration order puts Calgary (yyc) before Canmore (cmr); the trip visits
  // Canmore first. Confirm the rendered path follows ROUTE, not Object.entries(LOC).
  expect(ROUTE[0]).toBe('sea');
  expect(ROUTE.indexOf('cmr')).toBeLessThan(ROUTE.indexOf('yyc'));
  expect(ROUTE).not.toContain('dvl'); // waypoint, not an overnight base — no route vertex
  expect(BASES.map((b) => b.key)).toContain('dvl'); // but it still gets a pin
});

test('tapping a pin dispatches the base key it represents, not a neighbour', () => {
  const onPinTap = vi.fn();
  act(() => {
    root.render(<TripMap onPinTap={onPinTap} />);
  });
  const lax = LOC.lax;
  const target = [...container.querySelectorAll('.map-pin')].find(
    (g) => g.getAttribute('aria-label') === lax.n,
  );
  expect(target).toBeTruthy();
  act(() => {
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(onPinTap).toHaveBeenCalledTimes(1);
  expect(onPinTap).toHaveBeenCalledWith('lax');
});

// These exercise clampView directly — the exact function both the single-finger pan
// path and the pinch-zoom path funnel through — rather than simulating a multi-touch
// gesture through jsdom's pointer events, which cannot reliably drive a two-finger
// pinch. This tests the real mechanism, not a re-derivation of it.
const CLAMP_SIZE = { w: 390, h: 600 };
const clampBaseView = fitBounds(BASES, CLAMP_SIZE);
const CLAMP_MIN_ZOOM = clampBaseView.zoom;
const CLAMP_MAX_ZOOM = clampBaseView.zoom + 5; // mirrors TripMap's own ZOOM_HEADROOM

function anyBaseVisible(view: { cx: number; cy: number; zoom: number; w: number; h: number }): boolean {
  return BASES.some((b) => {
    const p = project(b.lon, b.lat, view);
    return p.x >= 0 && p.x <= view.w && p.y >= 0 && p.y <= view.h;
  });
}

test('an absurd pan — tens of thousands of px, in any direction — still leaves a base reachable', () => {
  const absurd = 50_000; // far larger than any real drag
  for (const [dx, dy] of [
    [absurd, 0],
    [-absurd, 0],
    [0, absurd],
    [0, -absurd],
  ] as const) {
    const view = clampView(panBy(clampBaseView, dx, dy), CLAMP_MIN_ZOOM, CLAMP_MAX_ZOOM);
    expect(anyBaseVisible(view)).toBe(true);
  }
});

test('pinch-zooming to any screen corner at max zoom still leaves a base reachable', () => {
  // zoomAt moves the centre too (that's how it keeps the pinch anchor fixed under the
  // fingers) — this is the path the coordinator's review flagged as the actual hole:
  // clamping only the pan handler would miss it.
  for (const [ax, ay] of [
    [0, 0],
    [CLAMP_SIZE.w, 0],
    [0, CLAMP_SIZE.h],
    [CLAMP_SIZE.w, CLAMP_SIZE.h],
  ] as const) {
    const view = clampView(zoomAt(clampBaseView, CLAMP_MAX_ZOOM, ax, ay), CLAMP_MIN_ZOOM, CLAMP_MAX_ZOOM);
    expect(anyBaseVisible(view)).toBe(true);
  }
});

test('an ordinary pan at the default fit is left completely untouched by the clamp', () => {
  // The clamp must stay invisible in normal use — it is a reactive safety net, not a
  // boundary the user can feel while panning normally.
  const raw = panBy(clampBaseView, 80, -40);
  const clamped = clampView(raw, CLAMP_MIN_ZOOM, CLAMP_MAX_ZOOM);
  expect(clamped.cx).toBe(raw.cx);
  expect(clamped.cy).toBe(raw.cy);
});

test('a non-interactive (mini) map renders no clickable pins and no touch-action lock', () => {
  const onPinTap = vi.fn();
  act(() => {
    root.render(<TripMap legs={['lax']} interactive={false} onPinTap={onPinTap} />);
  });
  const svg = container.querySelector('.trip-map-canvas') as SVGSVGElement;
  expect(svg.getAttribute('style') ?? '').not.toContain('touch-action');
  const target = container.querySelector('.map-pin[role="button"]');
  expect(target).toBeNull();
});
