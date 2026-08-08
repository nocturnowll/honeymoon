import type { Booking } from '../state/schema';

/** The minimal shape these functions need: `date` required, everything
 *  else — including `end` and `type` — optional. Derived from `Booking`
 *  (not a hand-rolled subset) so a full booking literal, with `id`/`name`/
 *  etc. still on it, is accepted without an excess-property error, and a
 *  real `Booking[]` from state is assignable with no cast. `type` is
 *  loosened from `Booking['type']`'s literal union to plain `string`: these
 *  functions only ever compare it to `'stay'`, and a plan-spec test that
 *  builds `{ type: 'stay', ... }` via a plain `const` (no `as const`) would
 *  otherwise widen to `string` and fail the stricter union. */
type BookingLike = Partial<Omit<Booking, 'type' | 'date'>> & { date: string; end?: string; type?: string };

/** Add one calendar day to an ISO `yyyy-mm-dd` string, local time (matches
 *  `dObj` in `./dates` — no UTC surprises around DST). */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hard backstop on the loop below. The trip is 23 days; nothing legitimate
 *  gets near this. It exists for `end` values that are well-formed ISO
 *  dates but absurd (`9999-99-99` passes the regex and is ~2.9M days out),
 *  which would otherwise lock up the UI for seconds during a render. */
const MAX_NIGHTS = 400;

/** Every night a booking covers, `date` inclusive through `end` exclusive —
 *  checkout day is not a night slept there. Degrades to a single night at
 *  `date` — never zero or negative nights, never a hang — for every
 *  nonsense case: no `end`, `end` not strictly after `date` (a range
 *  entered backwards or as a single point), or either date not a
 *  well-formed `yyyy-mm-dd` string.
 *
 *  That last case matters beyond typos in the sheet: this app has no
 *  server, state arrives by merging a `state.json` a second phone wrote,
 *  possibly on a different build, and nothing validates its shape on the
 *  way in. Without the regex guard, a lexicographic string comparison
 *  (`cur < b.end`) never terminates against a non-date `end` like `'zzz'` —
 *  `'2026-...' < 'zzz'` is true forever, since every digit sorts below
 *  every letter. */
export function nightsCovered(b: BookingLike): string[] {
  if (!b.end || !ISO_DATE.test(b.date) || !ISO_DATE.test(b.end) || b.end <= b.date) return [b.date];
  const nights: string[] = [];
  for (let cur = b.date; cur < b.end && nights.length < MAX_NIGHTS; cur = nextDay(cur)) nights.push(cur);
  return nights;
}

/** Bookings whose stay covers the given ISO date — a multi-night stay
 *  matches every night it covers, not just its start date. */
export function bookingsOnDate<T extends BookingLike>(bookings: T[], iso: string): T[] {
  return bookings.filter(b => nightsCovered(b).includes(iso));
}

/** Trip nights with no `stay` booking covering them. Callers pass whichever
 *  days should count (e.g. excluding "In the air" nights); a multi-night
 *  stay no longer reports its own interior nights as unbooked. */
export function unbookedNights(days: { d: string }[], bookings: BookingLike[]): string[] {
  const covered = new Set(bookings.filter(b => b.type === 'stay').flatMap(nightsCovered));
  return days.filter(d => !covered.has(d.d)).map(d => d.d);
}
