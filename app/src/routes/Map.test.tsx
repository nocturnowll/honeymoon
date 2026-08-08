import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DAYS } from '../data/itinerary';
import { Map } from './Map';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.location.hash = '';
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.location.hash = '';
});

test('the map tab renders all 12 trip pins', () => {
  act(() => {
    root.render(<Map />);
  });
  expect(container.querySelectorAll('.map-pin')).toHaveLength(12);
});

test('tapping a pin navigates to the first day whose base matches it', () => {
  act(() => {
    root.render(<Map />);
  });
  // Los Angeles is the last base and — unlike Death Valley — has real days
  // based there, so this exercises the real lookup against real trip data
  // rather than a hand-picked stub.
  const expectedIndex = DAYS.findIndex((d) => d.base === 'lax');
  expect(expectedIndex).toBeGreaterThanOrEqual(0);

  const pins = [...container.querySelectorAll('.map-pin')];
  const target = pins.find((g) => g.getAttribute('aria-label') === 'Los Angeles');
  expect(target).toBeTruthy();
  act(() => {
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(window.location.hash).toBe(`#/itinerary/day/${expectedIndex}`);
});

test('tapping a waypoint pin with no day based there is a no-op, not a bad route', () => {
  act(() => {
    root.render(<Map />);
  });
  // Death Valley (dvl) is a waypoint — BASES includes it for the pin, ROUTE and
  // DAYS do not, so there is no "first day" to route to.
  expect(DAYS.findIndex((d) => d.base === 'dvl')).toBe(-1);

  const pins = [...container.querySelectorAll('.map-pin')];
  const target = pins.find((g) => g.getAttribute('aria-label') === 'Death Valley');
  expect(target).toBeTruthy();
  act(() => {
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(window.location.hash).toBe('');
});

test('the legend explains both pin styles and the route line', () => {
  act(() => {
    root.render(<Map />);
  });
  const legend = container.querySelector('.map-legend');
  expect(legend).toBeTruthy();
  expect(legend!.querySelector('.map-legend-dot.on-route')).toBeTruthy();
  expect(legend!.querySelector('.map-legend-dot.waypoint')).toBeTruthy();
  expect(legend!.textContent).toContain('Overnight base');
  expect(legend!.textContent).toContain('Waypoint');
  expect(legend!.textContent).toContain('Route');
});
