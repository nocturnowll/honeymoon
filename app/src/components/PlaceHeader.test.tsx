import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { LOC } from '../data/itinerary';
import { PlaceHeader } from './PlaceHeader';

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

test('the leg mini map renders scoped to its own base, and only that base', () => {
  act(() => {
    root.render(<PlaceHeader base="sea" dayIndexes={[0, 1]} />);
  });
  const pins = [...container.querySelectorAll('.map-pin')];
  expect(pins).toHaveLength(1);
  expect(pins[0].getAttribute('aria-label')).toBe(null); // non-interactive pins carry no aria-label
});

test('the leg mini map is non-interactive: no tappable pins, no touch-action lock', () => {
  act(() => {
    root.render(<PlaceHeader base="sea" dayIndexes={[0, 1]} />);
  });
  expect(container.querySelector('.map-pin[role="button"]')).toBeNull();
  const svg = container.querySelector('.trip-map-canvas') as SVGSVGElement;
  expect(svg.getAttribute('style') ?? '').not.toContain('touch-action');
});

test('tapping the mini map opens the full Map tab, not a per-pin route', () => {
  act(() => {
    root.render(<PlaceHeader base="lax" dayIndexes={[20, 21]} />);
  });
  const trigger = container.querySelector('.place-mini-map') as HTMLButtonElement;
  expect(trigger).toBeTruthy();
  expect(trigger.getAttribute('aria-label')).toContain(LOC.lax.n);
  act(() => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(window.location.hash).toBe('#/map');
});
