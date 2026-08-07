// E2E-ONLY. Exercises the app's real IndexedDB helpers from state/persist.ts
// in a genuine browser, since jsdom has no IndexedDB and this path is
// otherwise completely uncovered. Not linked from index.html — never reached
// by real users, only by app/e2e/smoke.spec.ts.
//
// window.__idbTest.del() is an unauthenticated delete primitive against the
// app's real IndexedDB store. idb-harness.html is gated out of the rollup
// input in vite.config.ts (only added when E2E=1) so a normal `bun run
// build` never emits this file or its chunk into dist/ — do not remove that
// gate or re-add this entry to the default build input.
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
