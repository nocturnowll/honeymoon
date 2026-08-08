import { afterEach, expect, test, vi } from 'vitest';
import { emptyState } from './schema';
import { migrateFileRefs } from './migrate';
import { merge } from './sync/merge';

const NOW = 1_800_000_000_000;
const legacy = (f: string) => ({ f }) as unknown as { p?: string; f: string };

afterEach(() => vi.restoreAllMocks());

test('repairs legacy refs in photos, outfits, docs, and booking files', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const state = emptyState();
  state.photos['1.0'] = legacy('data/photos/photos_1.0.jpg') as never;
  state.outfits.sea = {
    img: legacy('data/photos/photos_outfit-main.jpg') as never,
    img2: legacy('data/photos/photos_outfit-alt.jpg') as never,
  };
  state.docs = [{ id: 'doc-1', label: 'Boarding pass', img: legacy('data/photos/photos_doc.jpg') as never }];
  state.bookings = [{
    id: 'booking-1', type: 'stay', name: 'Sample stay', date: '2026-09-14',
    files: [legacy('data/photos/photos_booking.jpg') as never],
  }];

  expect(migrateFileRefs(state)).toBe(5);
  expect(state.photos['1.0']).toEqual({ p: 'photos_1.0', f: 'data/photos/photos_1.0.jpg' });
  expect(state.outfits.sea).toEqual({
    img: { p: 'photos_outfit-main', f: 'data/photos/photos_outfit-main.jpg' },
    img2: { p: 'photos_outfit-alt', f: 'data/photos/photos_outfit-alt.jpg' },
  });
  expect(state.docs[0]?.img).toEqual({ p: 'photos_doc', f: 'data/photos/photos_doc.jpg' });
  expect(state.bookings[0]?.files?.[0]).toEqual({ p: 'photos_booking', f: 'data/photos/photos_booking.jpg' });
  expect(state._t).toEqual({
    'photos:1.0': NOW,
    'outfits:sea': NOW,
    'docs:doc-1': NOW,
    'bookings:booking-1': NOW,
  });
});

test('does not modify valid refs, non-jpg files, nulls, or empty filenames', () => {
  const valid = { p: 'already', f: 'data/photos/already.jpg' };
  const nonJpg = legacy('data/photos/document.pdf');
  const empty = legacy('data/photos/.jpg');
  const state = emptyState();
  state.photos = { valid, nonJpg: nonJpg as never, nullish: null as never, empty: empty as never };

  expect(migrateFileRefs(state)).toBe(0);
  expect(state.photos).toEqual({ valid, nonJpg, nullish: null, empty });
  expect(state._t).toBeUndefined();
});

test('is idempotent after the first repair', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const state = emptyState();
  state.photos.one = legacy('data/photos/photos_one.jpg') as never;

  expect(migrateFileRefs(state)).toBe(1);
  const migrated = JSON.stringify(state);
  expect(migrateFileRefs(state)).toBe(0);
  expect(JSON.stringify(state)).toBe(migrated);
});

// --- Regression coverage for the remote-stamp bug -------------------------
//
// migrateFileRefs runs on the freshly-fetched remote snapshot in store.ts,
// before merge(). A shape repair (adding `p` to a legacy `{ f }` ref) is not
// an edit and must never bump `_t` on the remote side — doing so makes the
// per-field last-write-wins merge in sync/merge.ts prefer the remote value
// unconditionally, silently dropping a newer, un-synced local edit to the
// same field (e.g. a replaced outfit photo).

test('local edit survives merge when remote migration does not stamp', () => {
  const local = emptyState();
  local._t = { 'outfits:sea': 2_000 };
  local.outfits.sea = { img: { p: 'photos_sea-new', f: 'data/photos/photos_sea-new.jpg' } };

  const remote = emptyState();
  remote._t = { 'outfits:sea': 1_000 };
  remote.outfits.sea = { img: legacy('data/photos/photos_sea-old.jpg') as never };

  migrateFileRefs(remote, { stamp: false });
  const merged = merge(local, remote);

  expect(merged.outfits.sea?.img?.p).toBe('photos_sea-new');
  expect(merged.outfits.sea).toEqual(local.outfits.sea);
  // NOTE: this assertion must FAIL if the remote call above is changed to
  // `migrateFileRefs(remote, { stamp: true })` (or the bare, defaulting
  // call) — the repair would then stamp remote._t['outfits:sea'] to
  // Date.now(), which outraces local's 2_000 and flips the merge winner to
  // the legacy remote ref. Verified manually; see PR/commit notes.
});

test('remote migration still repairs shape (sets p) even without stamping', () => {
  const remote = emptyState();
  remote.outfits.sea = { img: legacy('data/photos/photos_sea-old.jpg') as never };
  remote.photos.one = legacy('data/photos/photos_one.jpg') as never;

  expect(migrateFileRefs(remote, { stamp: false })).toBe(2);
  expect(remote.outfits.sea.img).toEqual({ p: 'photos_sea-old', f: 'data/photos/photos_sea-old.jpg' });
  expect(remote.photos.one).toEqual({ p: 'photos_one', f: 'data/photos/photos_one.jpg' });
});

test('remote migration leaves remote._t untouched for repaired keys', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const remote = emptyState();
  remote._t = { 'outfits:sea': 1_000 };
  remote.outfits.sea = { img: legacy('data/photos/photos_sea-old.jpg') as never };
  remote.photos.one = legacy('data/photos/photos_one.jpg') as never; // no prior _t entry

  migrateFileRefs(remote, { stamp: false });

  expect(remote._t).toEqual({ 'outfits:sea': 1_000 });
  expect(remote._t?.['photos:one']).toBeUndefined();
});

test('local path (default stamp: true) still stamps, so the repair propagates', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const local = emptyState();
  local.outfits.sea = { img: legacy('data/photos/photos_sea-old.jpg') as never };

  expect(migrateFileRefs(local)).toBe(1); // no opts: defaults to stamp: true
  expect(local.outfits.sea.img).toEqual({ p: 'photos_sea-old', f: 'data/photos/photos_sea-old.jpg' });
  expect(local._t).toEqual({ 'outfits:sea': NOW });
});
