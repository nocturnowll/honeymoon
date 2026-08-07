import { expect, test } from 'vitest';
import { merge, touch } from './merge';
import { emptyState, type TripState } from '../schema';
import fixture from '../__fixtures__/state.json';

const at = (s: TripState, sec: string, key: string, t: number) => {
  s._t = s._t || {}; s._t[`${sec}:${key}`] = t;
};

test('a production-shaped state survives a merge against itself unchanged', () => {
  const real = { ...emptyState(), ...(fixture as unknown as TripState) };
  const out = merge(real, real);
  expect(Object.keys(out.photos)).toHaveLength(2);
  expect(out.notes['8']).toBe('Sample note one');
  expect(out.notes['16']).toBe('Sample note two');
  // done:0.7 is present on both sides here (self-merge), so this only checks
  // that its timestamp is preserved via the hasL&&hasR path, not tombstone
  // handling — real tombstone coverage is test 5 below.
  expect(out._t!['done:0.7']).toBe(1785861151217);
});

test('two devices editing different fields both keep their work', () => {
  const a = emptyState(); a.notes['1'] = 'kenny';  at(a, 'notes', '1', 100);
  const b = emptyState(); b.notes['2'] = 'hersh';  at(b, 'notes', '2', 100);
  const out = merge(a, b);
  expect(out.notes['1']).toBe('kenny');
  expect(out.notes['2']).toBe('hersh');
});

test('the same field edited on both devices resolves to the newer edit', () => {
  const a = emptyState(); a.notes['1'] = 'older'; at(a, 'notes', '1', 100);
  const b = emptyState(); b.notes['1'] = 'newer'; at(b, 'notes', '1', 200);
  expect(merge(a, b).notes['1']).toBe('newer');
});

test('a deletion propagates instead of being resurrected by the other device', () => {
  const a = emptyState();                          at(a, 'notes', '1', 200);
  const b = emptyState(); b.notes['1'] = 'stale';  at(b, 'notes', '1', 100);
  const out = merge(a, b);
  expect(out.notes['1']).toBeUndefined();
  expect(out._t!['notes:1']).toBe(200);
});

test('a tombstone survives when the key is gone from both sides', () => {
  const a = emptyState(); at(a, 'done', '0.7', 500);
  const b = emptyState(); at(b, 'done', '0.7', 400);
  expect(merge(a, b)._t!['done:0.7']).toBe(500);
});

test('id-keyed arrays merge per item and stay sorted by date', () => {
  const a = emptyState();
  a.bookings = [{ id:'x', type:'stay', name:'Zion', date:'2026-09-28' }];
  at(a, 'bookings', 'x', 100);
  const b = emptyState();
  b.bookings = [{ id:'y', type:'stay', name:'Canmore', date:'2026-09-18' }];
  at(b, 'bookings', 'y', 100);
  const out = merge(a, b);
  expect(out.bookings.map(x => x.name)).toEqual(['Canmore', 'Zion']);
});

test('touch stamps the section:key the merge reads', () => {
  const s = emptyState();
  touch(s, 'notes', '4');
  expect(s._t!['notes:4']).toBeGreaterThan(0);
});

test('a booking the other phone deleted is not resurrected here', () => {
  const a = emptyState();                    // this phone still has it
  a.bookings = [{ id:'z', type:'stay', name:'Bryce', date:'2026-09-30' }];
  at(a, 'bookings', 'z', 100);
  const b = emptyState();                    // other phone deleted it, later
  at(b, 'bookings', 'z', 200);
  const out = merge(a, b);
  expect(out.bookings).toHaveLength(0);
  expect(out._t!['bookings:z']).toBe(200);
});

test('a corrupt section in the remote payload degrades to empty, it does not abort the sync', () => {
  const a = emptyState(); a.notes['1'] = 'kept'; at(a, 'notes', '1', 100);
  const b = { ...emptyState(), bookings: 0 as unknown as [] };
  expect(() => merge(a, b)).not.toThrow();
  expect(merge(a, b).notes['1']).toBe('kept');
});
