import { expect, test, beforeEach, vi } from 'vitest';
import { store } from './store';

beforeEach(() => { localStorage.clear(); store.reset(); });

test('a mutation stamps _t so the merge can see it', () => {
  store.mutate('notes', '5', s => { s.notes['5'] = 'hello'; });
  expect(store.getState()._t!['notes:5']).toBeGreaterThan(0);
});

test('a mutation persists to the frozen key', () => {
  store.mutate('notes', '5', s => { s.notes['5'] = 'hello'; });
  expect(JSON.parse(localStorage.getItem('larchcanyon')!).notes['5']).toBe('hello');
});

test('subscribers are notified once per mutation', () => {
  const fn = vi.fn();
  store.subscribe(fn);
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  expect(fn).toHaveBeenCalledTimes(1);
});

test('a failed write is reported in status rather than swallowed', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => { throw new Error('QuotaExceededError'); });
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  expect(store.status().saveFailed).toBe(true);
  spy.mockRestore();
});
