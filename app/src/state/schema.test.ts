import { expect, test } from 'vitest';
import { emptyState, SYNCED, BY_ID } from './schema';
import fixture from './__fixtures__/state.json';

test('SYNCED sections match the legacy app exactly', () => {
  expect(SYNCED).toEqual(['done','items','bookings','photos','outfits',
    'docs','todos','packing','spend','notes','cards']);
});

test('BY_ID sections match the legacy app exactly', () => {
  expect(BY_ID).toEqual(['bookings','docs','spend','cards']);
});

test('every key in a production-shaped state is known to the schema', () => {
  const known = new Set([...SYNCED, '_t', '_updated', '_by', '_note', 'v']);
  for (const k of Object.keys(fixture)) expect(known.has(k)).toBe(true);
});

test('emptyState carries every synced section', () => {
  const s = emptyState();
  for (const k of SYNCED) expect(s).toHaveProperty(k);
});
