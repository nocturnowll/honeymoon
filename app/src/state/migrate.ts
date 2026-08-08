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
  stamp: boolean,
): number {
  const id = legacyPhotoId(value);
  if (!id) return 0;
  (value as PhotoRef).p = id;
  if (stamp) {
    state._t = state._t || {};
    state._t[`${section}:${key}`] = Date.now();
  }
  return 1;
}

/**
 * Repair refs written by the pre-IndexedDB app as `{ f }` without `p`.
 *
 * The filename is the current IndexedDB key: `data/photos/photos_1.0.jpg`
 * becomes `photos_1.0`. This is intentionally in-place and idempotent so the
 * corrected state can merge normally and older builds can keep reading `f`.
 *
 * `opts.stamp` (default `true`) controls whether a repair also bumps `_t`.
 * Stamping is correct for *local* state — that's what propagates the repair
 * to the other phone. It must be `false` for a freshly-fetched *remote*
 * snapshot: shape repair is not an edit, and stamping it with `Date.now()`
 * would make the remote value win the per-field merge unconditionally,
 * silently dropping a newer local edit to the same field.
 */
export function migrateFileRefs(state: TripState, opts?: { stamp?: boolean }): number {
  const stamp = opts?.stamp ?? true;
  let fixed = 0;
  for (const [key, value] of Object.entries(state.photos || {})) {
    fixed += repair(state, value, 'photos', key, stamp);
  }
  for (const [key, outfit] of Object.entries(state.outfits || {})) {
    if (!outfit) continue;
    fixed += repair(state, outfit.img, 'outfits', key, stamp);
    fixed += repair(state, outfit.img2, 'outfits', key, stamp);
  }
  for (const doc of state.docs || []) {
    fixed += repair(state, doc.img, 'docs', doc.id, stamp);
  }
  for (const booking of state.bookings || []) {
    for (const file of booking.files || []) {
      fixed += repair(state, file, 'bookings', booking.id, stamp);
    }
  }
  return fixed;
}
