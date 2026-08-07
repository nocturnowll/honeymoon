import type { PhotoRef, TripState } from './schema';

function legacyPhotoId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const ref = value as Partial<PhotoRef>;
  if (ref.p || typeof ref.f !== 'string' || !ref.f.endsWith('.jpg')) return null;
  const filename = ref.f.split('/').pop() ?? '';
  const id = filename.slice(0, -4);
  return id || null;
}

function repair(
  state: TripState,
  value: unknown,
  section: string,
  key: string,
): number {
  const id = legacyPhotoId(value);
  if (!id) return 0;
  (value as PhotoRef).p = id;
  state._t = state._t || {};
  state._t[`${section}:${key}`] = Date.now();
  return 1;
}

/**
 * Repair refs written by the pre-IndexedDB app as `{ f }` without `p`.
 *
 * The filename is the current IndexedDB key: `data/photos/photos_1.0.jpg`
 * becomes `photos_1.0`. This is intentionally in-place and idempotent so the
 * corrected state can merge normally and older builds can keep reading `f`.
 */
export function migrateFileRefs(state: TripState): number {
  let fixed = 0;
  for (const [key, value] of Object.entries(state.photos || {})) {
    fixed += repair(state, value, 'photos', key);
  }
  for (const [key, outfit] of Object.entries(state.outfits || {})) {
    if (!outfit) continue;
    fixed += repair(state, outfit.img, 'outfits', key);
    fixed += repair(state, outfit.img2, 'outfits', key);
  }
  for (const doc of state.docs || []) {
    fixed += repair(state, doc.img, 'docs', doc.id);
  }
  for (const booking of state.bookings || []) {
    for (const file of booking.files || []) {
      fixed += repair(state, file, 'bookings', booking.id);
    }
  }
  return fixed;
}
