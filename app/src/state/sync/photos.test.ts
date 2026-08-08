import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { collectRefs, uploadPending, resolveRef, sweepOrphans, PHOTO_DIR } from './photos';
import { emptyState } from '../schema';
import type { GitHubRepo } from './github';
import { idbDel, idbGet, idbKeys, idbPut } from '../persist';

vi.mock('../persist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../persist')>();
  return { ...actual, idbGet: vi.fn(), idbKeys: vi.fn(), idbDel: vi.fn(), idbPut: vi.fn() };
});

test('refs are collected from photos, outfits, docs and booking files', () => {
  const s = emptyState();
  s.photos['1.0'] = { p: 'a' };
  s.outfits['yos'] = { img: { p: 'b' }, img2: { p: 'c' } };
  s.docs = [{ id: 'd1', label: 'Boarding pass', img: { p: 'd' } }];
  s.bookings = [{ id:'b1', type:'stay', name:'Zion', date:'2026-09-28',
    files: [{ p: 'e' }] }];
  expect(collectRefs(s).map(r => r.p).sort()).toEqual(['a','b','c','d','e']);
});

test('string photo values from the legacy format are not treated as refs', () => {
  const s = emptyState();
  s.photos['2.0'] = 'https://example.com/x.jpg';
  expect(collectRefs(s)).toHaveLength(0);
});

test('photos are written to the frozen remote directory', () => {
  expect(PHOTO_DIR).toBe('data/photos');
});

/** `collectRefs` walking `bookings[].files` was, until Task 5, never
 *  exercised end to end — nothing had ever put a real blob behind one of
 *  those refs. These tests back that path with an in-memory IndexedDB stand-
 *  in (jsdom has no real IndexedDB — this is why the app also keeps a
 *  Playwright harness) and a fake GitHubRepo, and drive it through the same
 *  `uploadPending` / `resolveRef` / `sweepOrphans` functions `store.sync()`
 *  calls for real. */
let blobs: Map<string, Blob>;

beforeEach(() => {
  blobs = new Map();
  (idbPut as unknown as Mock).mockImplementation(async (k: string, b: Blob) => { blobs.set(k, b); return true; });
  (idbGet as unknown as Mock).mockImplementation(async (k: string) => blobs.get(k) ?? null);
  (idbDel as unknown as Mock).mockImplementation(async (k: string) => { blobs.delete(k); return true; });
  (idbKeys as unknown as Mock).mockImplementation(async () => [...blobs.keys()]);
});

afterEach(() => vi.restoreAllMocks());

function fakeRepo() {
  const remote = new Map<string, { content: string; sha: string }>();
  const repo = {
    getFile: vi.fn(async (path: string) => remote.get(path) ?? null),
    putFile: vi.fn(async (path: string, b64: string) => {
      const sha = `sha-${path}`;
      remote.set(path, { content: b64, sha });
      return { content: b64, sha };
    }),
    getBlob: vi.fn(async () => null),
  };
  return repo as unknown as GitHubRepo;
}

test('a booking attachment — a photo and a PDF — round-trips through upload and resolve', async () => {
  const s = emptyState();
  s.bookings = [{
    id: 'b1', type: 'stay', name: 'Sample lodge', date: '2026-09-28',
    files: [{ p: 'photo1' }, { p: 'doc1' }],
  }];
  blobs.set('photo1', new Blob(['fake jpeg bytes'], { type: 'image/jpeg' }));
  blobs.set('doc1', new Blob(['%PDF-1.4 fake confirmation'], { type: 'application/pdf' }));
  const repo = fakeRepo();

  const uploaded = await uploadPending(repo, s);
  expect(uploaded).toBe(2);
  const [photoRef, pdfRef] = s.bookings[0]!.files!;
  expect(photoRef!.f).toBe(`${PHOTO_DIR}/photo1.jpg`);
  expect(pdfRef!.f).toBe(`${PHOTO_DIR}/doc1.pdf`);

  // Simulate a second device: no local blob yet, only the refs synced in.
  blobs.clear();
  const photoBack = await resolveRef(repo, photoRef!);
  const pdfBack = await resolveRef(repo, pdfRef!);
  expect(photoBack?.type).toBe('image/jpeg');
  expect(pdfBack?.type).toBe('application/pdf');
  expect(await photoBack?.text()).toBe('fake jpeg bytes');
  expect(await pdfBack?.text()).toBe('%PDF-1.4 fake confirmation');
  // resolveRef also re-seeds the local store, so the next sweep sees it live.
  expect(blobs.has('photo1')).toBe(true);
  expect(blobs.has('doc1')).toBe(true);
});

test('deleting a booking releases its attachment blobs for sweepOrphans to reclaim', async () => {
  blobs.set('photo1', new Blob(['jpeg'], { type: 'image/jpeg' }));
  blobs.set('doc1', new Blob(['pdf'], { type: 'application/pdf' }));
  blobs.set('kept', new Blob(['still referenced elsewhere']));

  // The booking (and its two files refs) is already gone from this state —
  // exactly what `s.bookings = s.bookings.filter(...)` produces on delete.
  const afterDelete = emptyState();
  afterDelete.photos['keep'] = { p: 'kept' };

  const swept = await sweepOrphans(afterDelete);
  expect(swept).toBe(2);
  expect(blobs.has('photo1')).toBe(false);
  expect(blobs.has('doc1')).toBe(false);
  expect(blobs.has('kept')).toBe(true);
});
