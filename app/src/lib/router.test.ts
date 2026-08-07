import { expect, test } from 'vitest';
import { hashForRoute, routeFromHash } from './router';

test('hash routing round trips an itinerary day route', () => {
  const route = routeFromHash('#/itinerary/day/14');
  expect(route).toEqual({ tab: 'itinerary', params: { day: '14' } });
  expect(hashForRoute(route)).toBe('#/itinerary/day/14');
});

test('hash routing handles tab routes', () => {
  expect(routeFromHash('#/budget')).toEqual({ tab: 'budget', params: {} });
  expect(hashForRoute({ tab: 'lists', params: {} })).toBe('#/lists');
});

test('unknown routes fall back to Now', () => {
  expect(routeFromHash('#/unknown/route')).toEqual({ tab: 'now', params: {} });
  expect(routeFromHash('')).toEqual({ tab: 'now', params: {} });
});
