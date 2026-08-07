import { useRef, useSyncExternalStore } from 'react';
import { emptyState, type TripState } from './schema';
import { loadState, saveState, loadSyncConfig, type SyncConfig } from './persist';
import { merge, touch } from './sync/merge';
import { GitHubRepo, ConflictError, encodeUtf8, decodeUtf8 } from './sync/github';
import { collectRefs, resolveRef, uploadPending, sweepOrphans } from './sync/photos';
import { idbDel, idbGet, idbKeys, idbPut } from './persist';
import type { PhotoRef } from './schema';

const STATE_PATH = 'data/state.json';
const NUDGE_MS = 15_000;
const AUTO_MS = 5 * 60_000;

/** Plan 1 is a foundation build with no UI, served at /honeymoon/next/.
 *  localStorage is per-ORIGIN, not per-path, so this build can see the real
 *  PAT and the real photo blobs the live app wrote at /honeymoon/. Until the
 *  Plan 3 cutover it must never sync, or merely opening the page would write
 *  to the live data repo and sweep real blobs. Flipped on by setting
 *  VITE_SYNC_ENABLED=1 at build time. */
const SYNC_ENABLED = import.meta.env.VITE_SYNC_ENABLED === '1';

export interface SyncStatus {
  configured: boolean; busy: boolean; error: string | null;
  last: Date | null; saveFailed: boolean;
}

class Store {
  private state: TripState = loadState();
  private listeners = new Set<() => void>();
  private cfg: SyncConfig | null = loadSyncConfig();
  private busy = false; private queued = false;
  private error: string | null = null; private last: Date | null = null;
  private saveFailed = false;
  private nudgeT: ReturnType<typeof setTimeout> | null = null;
  private auto: ReturnType<typeof setInterval> | null = null;
  private syncEnabled = SYNC_ENABLED;
  private photoUrls = new Map<string, string>();
  private photoRevision = 0;
  private booted = false;

  getState() { return this.state; }
  status(): SyncStatus {
    return { configured: this.syncEnabled && !!(this.cfg?.token && this.cfg.owner && this.cfg.repo),
      busy: this.busy, error: this.error, last: this.last, saveFailed: this.saveFailed };
  }
  /** Test seam, and the Plan 3 cutover switch. */
  enableSync(on: boolean) { this.syncEnabled = on; }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.state = { ...this.state }; this.listeners.forEach(f => f()); }

  /** Test seam. */
  reset() {
    this.state = emptyState(); this.cfg = null; this.busy = false;
    this.error = null; this.last = null; this.saveFailed = false;
    this.queued = false;
    this.booted = false;
    this.photoRevision = 0;
    this.photoUrls.forEach(url => URL.revokeObjectURL(url));
    this.photoUrls.clear();
    this.listeners.clear();
    if (this.nudgeT) { clearTimeout(this.nudgeT); this.nudgeT = null; }
    if (this.auto) { clearInterval(this.auto); this.auto = null; }
    this.syncEnabled = SYNC_ENABLED;
  }

  /** The only way state changes. Stamps `_t`, persists, schedules a push. */
  mutate(section: string, key: string | number, fn: (s: TripState) => void) {
    fn(this.state);
    touch(this.state, section, key);
    this.saveFailed = !saveState(this.state);
    this.emit();
    this.nudge();
  }

  setConfig(c: SyncConfig | null) { this.cfg = c; if (c) this.startAuto(); }

  /** Resolve remote photo refs after state merge. Sync remains the only caller. */
  async hydrateLocalPhotos(): Promise<boolean> {
    let arrived = false;
    for (const id of await idbKeys()) {
      if (this.photoUrls.has(id)) continue;
      const blob = await idbGet(id);
      if (blob) { this.photoUrls.set(id, URL.createObjectURL(blob)); arrived = true; }
    }
    if (arrived) { this.photoRevision++; this.emit(); }
    return arrived;
  }

  getPhotoRevision() { return this.photoRevision; }

  /** Save a user-selected image locally and make it immediately renderable. */
  async addLocalPhoto(blob: Blob): Promise<PhotoRef> {
    const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await idbPut(id, blob);
    this.photoUrls.set(id, URL.createObjectURL(blob));
    this.photoRevision++;
    this.emit();
    return { p: id };
  }

  /** Remove a local blob when a user replaces or clears an outfit photo. */
  async removeLocalPhoto(ref: PhotoRef | undefined): Promise<void> {
    if (!ref) return;
    const url = this.photoUrls.get(ref.p);
    if (url) { URL.revokeObjectURL(url); this.photoUrls.delete(ref.p); }
    await idbDel(ref.p);
    this.photoRevision++;
    this.emit();
  }

  async hydratePhotos(repo?: GitHubRepo): Promise<boolean> {
    if (!this.syncEnabled || !repo) return false;
    let arrived = false;
    for (const ref of collectRefs(this.state)) {
      const before = this.photoUrls.has(ref.p);
      const blob = await resolveRef(repo, ref);
      if (blob && !before) {
        const existing = this.photoUrls.get(ref.p);
        if (existing) URL.revokeObjectURL(existing);
        this.photoUrls.set(ref.p, URL.createObjectURL(blob));
        arrived = true;
      }
    }
    const live = new Set(collectRefs(this.state).map(ref => ref.p));
    for (const [id, url] of this.photoUrls) {
      if (!live.has(id)) { URL.revokeObjectURL(url); this.photoUrls.delete(id); }
    }
    if (arrived) { this.photoRevision++; this.emit(); }
    return arrived;
  }

  photoUrl(ref: PhotoRef | string | null | undefined): string | null {
    if (!ref) return null;
    if (typeof ref === 'string') return ref.startsWith('data:') || ref.startsWith('http') ? ref : null;
    return this.photoUrls.get(ref.p) ?? null;
  }

  /** Run the one-time boot sync immediately when sync is configured and enabled. */
  boot() {
    if (this.booted || !this.syncEnabled || !this.status().configured || !navigator.onLine) return;
    this.booted = true;
    void this.sync(true);
  }

  nudge() {
    if (!this.status().configured) return;
    if (this.nudgeT) clearTimeout(this.nudgeT);
    this.nudgeT = setTimeout(() => {
      this.nudgeT = null;
      if (!this.busy && navigator.onLine) void this.sync(true);
    }, NUDGE_MS);
  }
  /** iOS freezes a backgrounded PWA, so a pending push must go now. */
  flush() {
    if (!this.nudgeT) return;
    clearTimeout(this.nudgeT); this.nudgeT = null;
    if (!this.busy && navigator.onLine) void this.sync(true);
  }
  /** Registered unconditionally — connecting mid-session used to leave the
   *  device with no timer at all until the next reload. */
  startAuto() {
    if (this.auto) return;
    this.auto = setInterval(() => {
      if (this.status().configured && !this.busy && navigator.onLine) void this.sync(true);
    }, AUTO_MS);
  }

  async sync(silent = false, depth = 0): Promise<boolean> {
    if (!this.syncEnabled) return false;
    if (!this.status().configured || !this.cfg) return false;
    if (this.busy) { this.queued = true; return false; }
    if (!navigator.onLine) { this.error = 'offline'; this.emit(); return false; }
    this.busy = true; this.error = null; this.emit();
    const repo = new GitHubRepo(this.cfg);
    try {
      const file = await repo.getFile(STATE_PATH);
      let remote: TripState = emptyState();
      if (file?.content) { try { remote = JSON.parse(decodeUtf8(file.content)); } catch { /* corrupt remote */ } }

      const merged = merge(this.state, remote);
      await uploadPending(repo, merged);
      merged._updated = new Date().toISOString();
      merged._by = this.cfg.device || 'device';

      try {
        await repo.putFile(STATE_PATH, encodeUtf8(JSON.stringify(merged, null, 1)),
          file?.sha ?? null, `sync from ${this.cfg.device || 'device'}`);
      } catch (e) {
        if (e instanceof ConflictError && depth < 4) {
          this.busy = false; return this.sync(silent, depth + 1);
        }
        throw e;
      }

      this.state = merged;
      this.saveFailed = !saveState(this.state);
      await this.hydratePhotos(repo);
      await sweepOrphans(this.state).catch(() => 0);
      this.last = new Date(); this.error = null;
      return true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Sync failed';
      return false;
    } finally {
      this.busy = false; this.emit();
      if (this.queued) { this.queued = false; setTimeout(() => void this.sync(true), 900); }
    }
  }
}

export const store = new Store();

export function useTripState(): TripState {
  return useSyncExternalStore(store.subscribe, () => store.getState());
}

export function usePhotoRevision(): number {
  return useSyncExternalStore(store.subscribe, () => store.getPhotoRevision(), () => 0);
}

export function useTripSelector<T>(selector: (state: TripState) => T): T {
  const lastState = useRef<TripState | null>(null);
  const selected = useRef<T | undefined>(undefined);
  const getSnapshot = () => {
    const state = store.getState();
    if (state !== lastState.current) {
      lastState.current = state;
      selected.current = selector(state);
    }
    return selected.current as T;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
