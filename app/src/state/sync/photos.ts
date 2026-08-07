import { idbGet, idbKeys, idbDel, idbPut } from '../persist';
import type { GitHubRepo } from './github';
import type { PhotoRef, TripState } from '../schema';

export const PHOTO_DIR = 'data/photos';

const isRef = (v: unknown): v is PhotoRef =>
  !!v && typeof v === 'object' && typeof (v as PhotoRef).p === 'string';

/** Every blob reference the state points at, from all four homes. */
export function collectRefs(s: TripState): PhotoRef[] {
  const out: PhotoRef[] = [];
  for (const v of Object.values(s.photos || {})) if (isRef(v)) out.push(v);
  for (const o of Object.values(s.outfits || {})) {
    if (!o) continue;
    if (isRef(o.img)) out.push(o.img);
    if (isRef(o.img2)) out.push(o.img2);
  }
  for (const d of s.docs || []) if (isRef(d.img)) out.push(d.img);
  for (const b of s.bookings || []) for (const f of b.files || []) if (isRef(f)) out.push(f);
  return out;
}

async function blobToBase64(b: Blob): Promise<string> {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.readAsDataURL(b);
  });
}

/** Upload every ref that has a local blob but no remote path yet. Mutates the
 *  refs in place to record `f`. Failures are left for the next sync. */
export async function uploadPending(repo: GitHubRepo, s: TripState): Promise<number> {
  let n = 0;
  for (const ref of collectRefs(s)) {
    if (ref.f) continue;
    const blob = await idbGet(ref.p);
    if (!blob) continue;
    const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg';
    const path = `${PHOTO_DIR}/${ref.p}.${ext}`;
    const b64 = await blobToBase64(blob);
    let sha: string | null = null;
    try { sha = (await repo.getFile(path))?.sha ?? null; } catch { /* new file */ }
    try { await repo.putFile(path, b64, sha, `photo ${ref.p}`); ref.f = path; n++; }
    catch { /* stays local, retried next sync */ }
  }
  return n;
}

/** Fetch a remote blob into the device store. Falls back to the Blobs API,
 *  because the Contents API returns no body above 1 MB. */
export async function resolveRef(repo: GitHubRepo, ref: PhotoRef): Promise<Blob | null> {
  const have = await idbGet(ref.p);
  if (have) return have;
  if (!ref.f) return null;
  try {
    const j = await repo.getFile(ref.f);
    if (!j) return null;
    let b64 = j.content;
    if ((!b64 || j.encoding === 'none') && j.sha) b64 = (await repo.getBlob(j.sha)) ?? undefined;
    if (!b64) return null;
    const bin = atob(b64.replace(/\s/g, ''));
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    const type = ref.f.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    const blob = new Blob([a], { type });
    await idbPut(ref.p, blob);
    return blob;
  } catch { return null; }
}

/** Drop blobs the state no longer references. Deleting a photo used to leave
 *  its blob behind forever, quietly filling the phone over a three-week trip. */
export async function sweepOrphans(s: TripState): Promise<number> {
  const live = new Set(collectRefs(s).map(r => r.p));
  const keys = await idbKeys();
  // A state referencing nothing while the device holds blobs means the merge
  // went wrong, not that everything was deleted. Never sweep on that.
  if (!live.size && keys.length) return 0;
  let n = 0;
  for (const k of keys) if (!live.has(k)) { await idbDel(k); n++; }
  return n;
}
