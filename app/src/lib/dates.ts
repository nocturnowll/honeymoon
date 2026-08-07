import { DAYS, TRIP } from '../data/itinerary';

export function dObj(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dLabel(s: string): string {
  return dObj(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dShort(s: string): { dd: number; mm: string } {
  const o = dObj(s);
  return { dd: o.getDate(), mm: o.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() };
}

export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dObj(b).getTime() - dObj(a).getTime()) / 864e5);
}

export function mins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function itemKey(di: number, si: number): string { return `${di}.${si}`; }

export function currentDayIdx(): number { return DAYS.findIndex(d => d.d === todayISO()); }

export type TripPhase = { p: 'before' | 'during' | 'after'; n: number };

export function tripPhase(): TripPhase {
  const t = todayISO();
  if (t < TRIP.start) return { p: 'before', n: daysBetween(t, TRIP.start) };
  if (t > TRIP.end) return { p: 'after', n: daysBetween(TRIP.end, t) };
  return { p: 'during', n: daysBetween(TRIP.start, t) + 1 };
}
