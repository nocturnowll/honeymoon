import { useSyncExternalStore } from 'react';
import { emptyState, type TripState } from './schema';
import { loadState, saveState, loadSyncConfig, type SyncConfig } from './persist';
import { merge, touch } from './sync/merge';
import { GitHubRepo, ConflictError, encodeUtf8, decodeUtf8 } from './sync/github';
import { uploadPending, sweepOrphans } from './sync/photos';

const STATE_PATH = 'data/state.json';
const NUDGE_MS = 15_000;
const AUTO_MS = 5 * 60_000;

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

  getState() { return this.state; }
  status(): SyncStatus {
    return { configured: !!(this.cfg?.token && this.cfg.owner && this.cfg.repo),
      busy: this.busy, error: this.error, last: this.last, saveFailed: this.saveFailed };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.state = { ...this.state }; this.listeners.forEach(f => f()); }

  /** Test seam. */
  reset() {
    this.state = emptyState(); this.cfg = null; this.busy = false;
    this.error = null; this.last = null; this.saveFailed = false;
    this.listeners.clear();
    if (this.nudgeT) { clearTimeout(this.nudgeT); this.nudgeT = null; }
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
