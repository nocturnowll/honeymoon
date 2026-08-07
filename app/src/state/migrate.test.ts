import { afterEach, expect, test, vi } from 'vitest';
import { emptyState } from './schema';
import { migrateFileRefs } from './migrate';

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
