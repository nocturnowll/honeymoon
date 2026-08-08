import { expect, test, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { store } from './store';
import { idbDel, idbGet, idbKeys, idbPut } from './persist';

// jsdom has no real IndexedDB (see photos.test.ts), so addLocalPhoto /
// removeLocalPhoto below need a stand-in backing store.
vi.mock('./persist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./persist')>();
  return { ...actual, idbGet: vi.fn(), idbKeys: vi.fn(), idbDel: vi.fn(), idbPut: vi.fn() };
});

const cfg = { owner:'o', repo:'r', branch:'main', token:'t', device:'d' };
const online = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

let idbBlobs: Map<string, Blob>;

beforeEach(() => {
  localStorage.clear(); store.reset(); vi.useFakeTimers();
  idbBlobs = new Map();
  (idbPut as unknown as Mock).mockImplementation(async (k: string, b: Blob) => { idbBlobs.set(k, b); return true; });
  (idbGet as unknown as Mock).mockImplementation(async (k: string) => idbBlobs.get(k) ?? null);
  (idbDel as unknown as Mock).mockImplementation(async (k: string) => { idbBlobs.delete(k); return true; });
  (idbKeys as unknown as Mock).mockImplementation(async () => [...idbBlobs.keys()]);
});
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

test('boot does not sync while sync is disabled', () => {
  store.setConfig(cfg);
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  online();
  store.boot();
  expect(spy).not.toHaveBeenCalled();
});

test('boot syncs once when enabled, configured, and online', () => {
  store.setConfig(cfg); store.enableSync(true); online();
  const spy = vi.spyOn(store, 'sync').mockResolvedValue(true);
  store.boot(); store.boot();
  expect(spy).toHaveBeenCalledTimes(1);
});

test('hydratePhotos does not fetch while sync is disabled', async () => {
  const repo = {} as never;
  const spy = vi.spyOn(globalThis, 'fetch');
  await expect(store.hydratePhotos(repo)).resolves.toBe(false);
  expect(spy).not.toHaveBeenCalled();
});

test('an explicit sync call is refused while sync is disabled', async () => {
  store.setConfig(cfg);
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  await expect(store.sync(true)).resolves.toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('photoType reports a PDF blob\'s MIME type once addLocalPhoto has it in hand', async () => {
  const ref = await store.addLocalPhoto(new Blob(['%PDF fake'], { type: 'application/pdf' }));
  expect(store.photoType(ref)).toBe('application/pdf');
  expect(store.photoUrl(ref)).not.toBeNull();
});

test('photoType reports an image blob\'s MIME type the same way', async () => {
  const ref = await store.addLocalPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }));
  expect(store.photoType(ref)).toBe('image/jpeg');
});

test('removeLocalPhoto releases both the object URL and the recorded type', async () => {
  const ref = await store.addLocalPhoto(new Blob(['%PDF fake'], { type: 'application/pdf' }));
  await store.removeLocalPhoto(ref);
  expect(store.photoType(ref)).toBeNull();
  expect(store.photoUrl(ref)).toBeNull();
  expect(idbBlobs.has(ref.p)).toBe(false);
});

test('deleting a booking\'s attachments through removeLocalPhoto drops the underlying blobs', async () => {
  const photo = await store.addLocalPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }));
  const pdf = await store.addLocalPhoto(new Blob(['pdf'], { type: 'application/pdf' }));
  store.mutate('bookings', 'b1', s => {
    s.bookings.push({ id: 'b1', type: 'stay', name: 'Sample lodge', date: '2026-09-28', files: [photo, pdf] });
  });
  expect(idbBlobs.size).toBe(2);

  // What BookingSheet's delete handler does: drop the booking, then release
  // every ref it held.
  const files = store.getState().bookings.find(b => b.id === 'b1')!.files!;
  store.mutate('bookings', 'b1', s => { s.bookings = s.bookings.filter(b => b.id !== 'b1'); });
  await Promise.all(files.map(ref => store.removeLocalPhoto(ref)));

  expect(store.getState().bookings).toHaveLength(0);
  expect(idbBlobs.size).toBe(0);
  expect(store.photoUrl(photo)).toBeNull();
  expect(store.photoUrl(pdf)).toBeNull();
});
