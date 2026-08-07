// Test-only entry point. Exercises the app's real IndexedDB helpers from
// state/persist.ts in a genuine browser, since jsdom has no IndexedDB and
// this path is otherwise completely uncovered. Not linked from index.html —
// never reached by real users, only by app/e2e/smoke.spec.ts.
import { idbPut, idbGet, idbDel, idbKeys } from './state/persist';

declare global {
  interface Window {
    __idbTest: {
      put(k: string, data: string, type: string): Promise<boolean>;
      get(k: string): Promise<{ data: string; type: string } | null>;
      del(k: string): Promise<boolean>;
      keys(): Promise<string[]>;
    };
  }
}

window.__idbTest = {
  async put(k, data, type) {
    return idbPut(k, new Blob([data], { type }));
  },
  async get(k) {
    const b = await idbGet(k);
    if (!b) return null;
    return { data: await b.text(), type: b.type };
  },
  async del(k) {
    return idbDel(k);
  },
  async keys() {
    return idbKeys();
  },
};
