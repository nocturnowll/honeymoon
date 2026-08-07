import { expect, test, beforeEach, afterEach, vi } from 'vitest';
import { store } from './store';

const cfg = { owner:'o', repo:'r', branch:'main', token:'t', device:'d' };
const online = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

beforeEach(() => { localStorage.clear(); store.reset(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

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

test('an edit schedules a debounced push rather than pushing immediately', () => {
  store.setConfig(cfg); store.enableSync(true); online();
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  expect(spy).not.toHaveBeenCalled();
  vi.advanceTimersByTime(15000);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('a burst of edits coalesces into a single push', () => {
  store.setConfig(cfg); store.enableSync(true); online();
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  for (let i = 0; i < 5; i++) {
    store.mutate('notes', String(i), s => { s.notes[String(i)] = 'x'; });
    vi.advanceTimersByTime(1000);
  }
  vi.advanceTimersByTime(15000);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('flush sends a pending push immediately, without waiting for the timer', () => {
  store.setConfig(cfg); store.enableSync(true); online();
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  store.flush();
  expect(spy).toHaveBeenCalledTimes(1);
});

test('flush with nothing pending does nothing', () => {
  store.setConfig(cfg); store.enableSync(true); online();
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  store.flush();
  expect(spy).not.toHaveBeenCalled();
});

test('startAuto registers exactly one interval however often it is called', () => {
  const spy = vi.spyOn(globalThis, 'setInterval');
  store.startAuto(); store.startAuto(); store.startAuto();
  expect(spy).toHaveBeenCalledTimes(1);
});

test('sync is disabled by default, so the foundation build cannot touch live data', async () => {
  store.setConfig(cfg);                    // real-looking config, but no enableSync
  const spy = vi.spyOn(store, 'sync');
  expect(store.status().configured).toBe(false);
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  vi.advanceTimersByTime(60000);
  expect(spy).not.toHaveBeenCalled();
});

test('an explicit sync call is refused while sync is disabled', async () => {
  store.setConfig(cfg);
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  await expect(store.sync(true)).resolves.toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
});
