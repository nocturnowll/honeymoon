import { expect, test } from 'vitest';
import { nightsCovered, bookingsOnDate, unbookedNights } from './bookings';

test('a stay spans every night from date to end, exclusive of checkout day', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' };
  expect(nightsCovered(b)).toEqual(['2026-09-14', '2026-09-15']);
});
test('a booking with no end covers a single night, as the old model did', () => {
  expect(nightsCovered({ id:'b', type:'stay', name:'X', date:'2026-09-14' }))
    .toEqual(['2026-09-14']);
});
test('a multi-night stay no longer reports its own nights as unbooked', () => {
  const days = [{d:'2026-09-14'},{d:'2026-09-15'},{d:'2026-09-16'}];
  const bookings = [{ id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' }];
  expect(unbookedNights(days, bookings)).toEqual(['2026-09-16']);
});
test('the banner appears on every night of a stay, not just the first', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' };
  expect(bookingsOnDate([b], '2026-09-15')).toHaveLength(1);
});

// Guard cases: a range entered backwards, or as a single point, must not
// produce zero or negative nights. Both degrade to the pre-range behaviour —
// one night at `date` — rather than throwing or returning an empty stay.
test('end before date degrades to a single night at date, not a negative range', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-16', end:'2026-09-14' };
  expect(nightsCovered(b)).toEqual(['2026-09-16']);
});
test('end equal to date degrades to a single night, not zero nights', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-14' };
  expect(nightsCovered(b)).toEqual(['2026-09-14']);
});

// State arrives by merging a state.json a second phone wrote, possibly on a
// different build — nothing validates its shape on the way in. A malformed
// `end` must degrade, not hang the app (a lexicographic string comparison
// against a non-date string like 'zzz' never terminates, since every digit
// sorts below every letter).
test('a non-date end degrades to a single night instead of looping forever', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'zzz' };
  expect(nightsCovered(b)).toEqual(['2026-09-14']);
});
test('a malformed date itself degrades to a single night at that value', () => {
  const b = { id:'b', type:'stay', name:'X', date:'not-a-date', end:'2026-09-16' };
  expect(nightsCovered(b)).toEqual(['not-a-date']);
});
test('an absurd but well-formed range is bounded, not a multi-second hang', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'9999-99-99' };
  const nights = nightsCovered(b);
  expect(nights.length).toBeLessThanOrEqual(400);
  expect(nights[0]).toBe('2026-09-14');
});
