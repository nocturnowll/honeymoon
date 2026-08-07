import { useSyncExternalStore } from 'react';

export type RouteTab = 'now' | 'itinerary' | 'budget' | 'lists' | 'map';
export interface Route { tab: RouteTab; params: Record<string, string> }

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'itinerary' && parts[1] === 'day' && parts[2] != null && /^\d+$/.test(parts[2])) {
    return { tab: 'itinerary', params: { day: parts[2] } };
  }
  const tab = parts[0] as RouteTab | undefined;
  if (tab && ['now', 'itinerary', 'budget', 'lists', 'map'].includes(tab)) return { tab, params: {} };
  return { tab: 'now', params: {} };
}

export function routeFromHash(hash: string): Route { return parseHash(hash); }
export function hashForRoute(route: Route): string {
  if (route.tab === 'itinerary' && route.params.day != null) return `#/itinerary/day/${route.params.day}`;
  return `#/${route.tab}`;
}
export function navigate(hash: string): void {
  if (typeof window !== 'undefined') window.location.hash = hash.replace(/^#?/, '#');
}
function subscribe(fn: () => void): () => void {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}
function snapshot(): string { return window.location.hash; }
export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, snapshot, () => '#/now'));
}
