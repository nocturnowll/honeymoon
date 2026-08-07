import { emptyState, type TripState } from './schema';
import { migrateFileRefs } from './migrate';

const STATE_KEY = 'larchcanyon';
const CFG_KEY = 'larchcanyon.gh';

export interface SyncConfig {
  owner: string; repo: string; branch: string; token: string; device: string;
}

export function loadState(): TripState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return emptyState();
    const state = { ...emptyState(), ...JSON.parse(raw) } as TripState;
    if (migrateFileRefs(state) > 0) {
      try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
      catch { /* keep the repaired in-memory state; the next write can retry */ }
    }
    return state;
  } catch { return emptyState(); }
}

/** Returns false when the write failed — the caller must surface this, because
 *  a silent failure means the edit exists only in memory and dies with the tab. */
export function saveState(s: TripState): boolean {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); return true; }
  catch { return false; }
}

export function loadSyncConfig(): SyncConfig | null {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); }
  catch { return null; }
}
export function saveSyncConfig(c: SyncConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
}
export function clearSyncConfig() { localStorage.removeItem(CFG_KEY); }

/* ---- IndexedDB: photo and document blobs ---- */
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    const r = indexedDB.open('larchcanyon', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}
async function store(mode: IDBTransactionMode) {
  return (await db()).transaction('blobs', mode).objectStore('blobs');
}
export async function idbPut(k: string, b: Blob): Promise<boolean> {
  const s = await store('readwrite');
  return new Promise((res, rej) => {
    const q = s.put(b, k);
    q.onsuccess = () => res(true); q.onerror = () => rej(q.error);
  });
}
export async function idbGet(k: string): Promise<Blob | null> {
  const s = await store('readonly');
  return new Promise(res => {
    const q = s.get(k);
    q.onsuccess = () => res(q.result || null); q.onerror = () => res(null);
  });
}
export async function idbDel(k: string): Promise<boolean> {
  const s = await store('readwrite');
  return new Promise(res => {
    const q = s.delete(k);
    q.onsuccess = () => res(true); q.onerror = () => res(false);
  });
}
export async function idbKeys(): Promise<string[]> {
  const s = await store('readonly');
  return new Promise(res => {
    const q = s.getAllKeys();
    q.onsuccess = () => res(q.result as string[]); q.onerror = () => res([]);
  });
}
