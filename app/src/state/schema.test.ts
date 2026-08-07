import { expect, test } from 'vitest';
import { emptyState, SYNCED, BY_ID, type Spend, type Card } from './schema';
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

test('Spend matches the field names the live app writes', () => {
  const s: Spend = { id:'s1', what:'Dinner', amt:42.5, cur:'USD', card:'c1', date:'2026-09-20' };
  expect(s.amt).toBe(42.5);
});

test('Card matches the field names the live app writes, including cash entries', () => {
  const c: Card = { id:'c1', type:'visa', nick:'Main', bank:'BCA', network:'visa',
    holder:'K E', last4:'1234', markup:2.5, fee:0, limit:5000 };
  expect(c.nick).toBe('Main');
  const cash: Card = { id:'c2', type:'cash', nick:'USD cash', limit:800, markup:0, fee:0 };
  expect(cash.type).toBe('cash');
});

test('emptyState carries every synced section', () => {
  const s = emptyState();
  for (const k of SYNCED) expect(s).toHaveProperty(k);
});
