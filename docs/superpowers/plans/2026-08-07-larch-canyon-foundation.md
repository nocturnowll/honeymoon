# Larch & Canyon Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Vite/React/TypeScript foundation and port the entire data
and sync layer, proven by tests against a production-shaped fixture, without
disturbing the live app.

**Architecture:** The SPA is built in `app/` and published to `/honeymoon/next/`
while the existing single-file app keeps serving `/honeymoon/` untouched. Cutover
is a one-line change in the deploy workflow, later, in Plan 3. The data layer is
a direct port — `merge.ts` especially is transcribed, not improved — because two
phones hold data that exists nowhere else.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Bun 1.3, Vitest, Playwright,
`vite-plugin-pwa`, GitHub Actions → GitHub Pages.

## Global Constraints

- **Bun only.** Never `npm`, never `yarn`, never `pnpm`. Install with `bun add`,
  run with `bun run`.
- **The live app must keep working.** Nothing in this plan modifies
  `index.html`, `sw.js`, `manifest.json` or `assets/` at the repository root.
- **Storage keys are frozen:** `larchcanyon` (state), `larchcanyon.gh` (sync
  config incl. PAT), `larchcanyon.fx` (rates). IndexedDB database `larchcanyon`
  version `1`, object store `blobs`.
- **Remote paths are frozen:** `data/state.json`, `data/photos/{id}.jpg`.
- **`SYNCED` sections, exact order:** `done`, `items`, `bookings`, `photos`,
  `outfits`, `docs`, `todos`, `packing`, `spend`, `notes`, `cards`.
- **`BY_ID` sections, exact:** `bookings`, `docs`, `spend`, `cards`.
- **Vite `base` is `/honeymoon/next/`** for this plan. Do not change it.
- Target ES2022. iOS Safari 16.4+ is the floor (both phones are current).

---

### Task 1: Scaffold and deploy pipeline

Stands up the project and moves Pages off the legacy branch builder, which on
2026-08-07 wedged for over a day and reported only `"Page build failed."` The
workflow republishes the current app at root verbatim, so the live URL is
unaffected.

**Files:**
- Create: `app/package.json`, `app/vite.config.ts`, `app/tsconfig.json`,
  `app/index.html`, `app/src/main.tsx`, `app/src/App.tsx`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: nothing
- Produces: a `bun run build` in `app/` emitting `app/dist/`; a Pages deploy that
  serves the legacy app at `/honeymoon/` and the SPA at `/honeymoon/next/`

- [ ] **Step 1: Initialise the project**

```bash
cd /Users/kenichiedberty/Development/larch-canyon-github/honeymoon
mkdir -p app/src
cd app
bun init -y
bun add react react-dom
bun add -d vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom
```

- [ ] **Step 2: Write `app/vite.config.ts`**

`defineConfig` must come from `vitest/config`, not `vite` — the one exported by
`vite` has no `test` key and the config will fail to typecheck.

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/honeymoon/next/',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
  test: { environment: 'jsdom' },
});
```

- [ ] **Step 2b: Write `app/tsconfig.json`**

`bun init` writes a tsconfig without JSX settings, so React files will not
compile until this replaces it.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "e2e"]
}
```

`resolveJsonModule` matters — Task 2 imports the JSON test
fixture directly.

- [ ] **Step 3: Write `app/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Larch &amp; Canyon</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Write `app/src/main.tsx` and `app/src/App.tsx`**

```tsx
// main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<App />);
```

```tsx
// App.tsx
export function App() {
  return <main><h1>Larch &amp; Canyon</h1><p>Foundation build.</p></main>;
}
```

- [ ] **Step 5: Verify the build runs**

Run: `cd app && bun run vite build`
Expected: exits 0, `app/dist/index.html` exists with asset paths under
`/honeymoon/next/`.

- [ ] **Step 6: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - name: Build SPA
        run: cd app && bun install --frozen-lockfile && bun run vite build
      - name: Assemble site
        run: |
          mkdir -p _site/next
          cp index.html sw.js manifest.json _site/
          cp -R assets _site/assets
          cp -R app/dist/* _site/next/
      - uses: actions/upload-pages-artifact@v3
        with: { path: _site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

- [ ] **Step 7: Switch Pages to the Actions source**

```bash
gh api -X PUT repos/nocturnowll/honeymoon/pages -f build_type=workflow
```

- [ ] **Step 8: Commit, push, and verify the live app is unharmed**

```bash
git add app .github
git commit -m "feat: Vite scaffold and Actions deploy, SPA served at /next/"
git push origin main
```

Then confirm **both** of these:

```bash
curl -s https://nocturnowll.github.io/honeymoon/index.html | grep -o "const BUILD='[^']*'"
curl -s -o /dev/null -w '%{http_code}\n' https://nocturnowll.github.io/honeymoon/next/
```

Expected: the first prints `const BUILD='2026.08.07-4'` (the legacy app, still
live), the second prints `200`. **If the first fails, revert Pages to branch
mode immediately** with
`gh api -X PUT repos/nocturnowll/honeymoon/pages -f build_type=legacy` and stop.

---

### Task 2: The state schema

One file that encodes the data-compatibility contract. Every later task depends
on these names.

**Files:**
- Create: `app/src/state/schema.ts`
- Create: `app/src/state/__fixtures__/state.json`
- Test: `app/src/state/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `TripState`, `Booking`, `PhotoRef`, `Outfit`, `TripDoc`, `Spend`,
  `Card`, `SYNCED`, `BY_ID`, `emptyState()`

- [ ] **Step 1: Build a synthetic fixture with the real structure**

> **Never commit the real `state.json`.** `nocturnowll/honeymoon` is a **public**
> repository — that is the entire reason trip data lives in the separate private
> `honeymoon-data` repo. The real snapshot holds Hershania's notes today, and
> will hold hotel addresses, confirmation numbers and card last-4s before the
> trip. Committing it would publish exactly what the two-repo architecture
> exists to protect.

The fixture must mirror the **shape and edge cases** of the production file, with
fabricated content. Those edge cases, taken from the real snapshot, are what the
tests actually need:

- a `_t` map with `section:key` entries whose values are epoch millis
- `photos` holding `{ "f": "data/photos/<id>.jpg" }` reference objects
- at least one **tombstone**: a `_t` entry whose key is absent from its section
  (the real file has `done:0.7` stamped while `done` holds `{"0.7": false}`)
- `_updated` as an ISO string and `_by` as a device name
- every section from `SYNCED` present, with the id-keyed ones as arrays

```json
{
  "_t": {
    "done:0.7": 1785861151217,
    "photos:1.0": 1785861489780,
    "photos:15.2": 1785861817695,
    "notes:8": 1785862471786,
    "notes:16": 1785863619274
  },
  "done": { "0.7": false },
  "items": {},
  "bookings": [],
  "photos": {
    "1.0": { "f": "data/photos/photos_1.0.jpg" },
    "15.2": { "f": "data/photos/photos_15.2.jpg" }
  },
  "outfits": {},
  "docs": [],
  "todos": {},
  "packing": {},
  "spend": [],
  "notes": { "8": "Sample note one", "16": "Sample note two" },
  "cards": [],
  "_updated": "2026-08-06T16:52:14.613Z",
  "_by": "Test Device"
}
```

Write this to `app/src/state/__fixtures__/state.json`.

If you ever want to check the real file, copy it to
`app/src/state/__fixtures__/state.real.json` — that name is gitignored — and
delete it afterwards. Never rename it into the tracked fixture.

- [ ] **Step 2: Write the failing test**

```ts
// app/src/state/schema.test.ts
import { expect, test } from 'vitest';
import { emptyState, SYNCED, BY_ID } from './schema';
import fixture from './__fixtures__/state.json';

test('SYNCED sections match the legacy app exactly', () => {
  expect(SYNCED).toEqual(['done','items','bookings','photos','outfits',
    'docs','todos','packing','spend','notes','cards']);
});

test('BY_ID sections match the legacy app exactly', () => {
  expect(BY_ID).toEqual(['bookings','docs','spend','cards']);
});

test('every key in the real production state is known to the schema', () => {
  const known = new Set([...SYNCED, '_t', '_updated', '_by', '_note', 'v']);
  for (const k of Object.keys(fixture)) expect(known.has(k)).toBe(true);
});

test('emptyState carries every synced section', () => {
  const s = emptyState();
  for (const k of SYNCED) expect(s).toHaveProperty(k);
});
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `cd app && bun run vitest run src/state/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 3: Write `app/src/state/schema.ts`**

```ts
/** Photo/document reference. `p` is the IndexedDB blob key; `f` is the path
 *  in the data repo once uploaded. A ref with no `f` has not synced yet. */
export interface PhotoRef { p: string; f?: string }

export interface Booking {
  id: string; type: 'stay'|'car'|'fly'|'act'|'eat'; name: string;
  date: string;            // ISO yyyy-mm-dd, start
  end?: string;            // ISO yyyy-mm-dd, added in Plan 3; older builds ignore it
  addr?: string; checkin?: string; checkout?: string;
  conf?: string; cost?: number; note?: string;
  files?: PhotoRef[];      // added in Plan 3
}

export interface Outfit { img?: PhotoRef; img2?: PhotoRef; pieces?: string; note?: string }
export interface TripDoc { id: string; label: string; img?: PhotoRef }
export interface Spend { id: string; date: string; cur: string; amount: number; card?: string; what?: string }
export interface Card { id: string; bank: string; name: string; last4: string; limit?: number; markup?: number; fee?: number }

export interface TripState {
  done: Record<string, boolean>;
  items: Record<string, { t?: string }>;
  bookings: Booking[];
  photos: Record<string, PhotoRef | string>;
  outfits: Record<string, Outfit>;
  docs: TripDoc[];
  todos: Record<string, boolean>;
  packing: Record<string, boolean>;
  spend: Spend[];
  notes: Record<string, string>;
  cards: Card[];
  _t?: Record<string, number>;
  _updated?: string;
  _by?: string;
  _note?: string;
  v?: number;
}

export const SYNCED = ['done','items','bookings','photos','outfits',
  'docs','todos','packing','spend','notes','cards'] as const;

export const BY_ID = ['bookings','docs','spend','cards'] as const;

export function emptyState(): TripState {
  return { done:{}, items:{}, bookings:[], photos:{}, outfits:{}, docs:[],
    todos:{}, packing:{}, spend:[], notes:{}, cards:[], v:1 };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/schema.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/state
git commit -m "feat: TripState schema, frozen against the live data format"
```

---

### Task 3: Local persistence

**Files:**
- Create: `app/src/state/persist.ts`
- Test: `app/src/state/persist.test.ts`

**Interfaces:**
- Consumes: `TripState`, `emptyState` from `./schema`
- Produces: `loadState(): TripState`, `saveState(s): boolean`,
  `idbPut(k,blob)`, `idbGet(k)`, `idbDel(k)`, `idbKeys()`,
  `loadSyncConfig()`, `saveSyncConfig(c)`, `clearSyncConfig()`,
  `SyncConfig` interface

- [ ] **Step 1: Write the failing test**

```ts
// app/src/state/persist.test.ts
import { expect, test, beforeEach } from 'vitest';
import { loadState, saveState, loadSyncConfig, saveSyncConfig } from './persist';
import { emptyState } from './schema';
import fixture from './__fixtures__/state.json';

beforeEach(() => localStorage.clear());

test('reads state written by the legacy app from the frozen key', () => {
  localStorage.setItem('larchcanyon', JSON.stringify(fixture));
  const s = loadState();
  expect(s.notes['8']).toBe('Sample note one');
  expect(Object.keys(s.photos)).toHaveLength(16);
});

test('missing sections are filled without clobbering present ones', () => {
  localStorage.setItem('larchcanyon', JSON.stringify({ notes: { 1: 'hi' } }));
  const s = loadState();
  expect(s.notes['1']).toBe('hi');
  expect(s.bookings).toEqual([]);
});

test('corrupt JSON yields an empty state rather than throwing', () => {
  localStorage.setItem('larchcanyon', '{not json');
  expect(loadState()).toEqual(emptyState());
});

test('saveState writes to the frozen key and reports success', () => {
  const s = emptyState(); s.notes['3'] = 'x';
  expect(saveState(s)).toBe(true);
  expect(JSON.parse(localStorage.getItem('larchcanyon')!).notes['3']).toBe('x');
});

test('sync config round-trips on its own key', () => {
  saveSyncConfig({ owner:'nocturnowll', repo:'honeymoon-data',
    branch:'main', token:'ghp_x', device:'Ken' });
  expect(loadSyncConfig()!.repo).toBe('honeymoon-data');
  expect(localStorage.getItem('larchcanyon.gh')).toContain('ghp_x');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd app && bun run vitest run src/state/persist.test.ts`
Expected: FAIL — cannot resolve `./persist`.

- [ ] **Step 3: Write `app/src/state/persist.ts`**

```ts
import { emptyState, type TripState } from './schema';

const STATE_KEY = 'larchcanyon';
const CFG_KEY = 'larchcanyon.gh';

export interface SyncConfig {
  owner: string; repo: string; branch: string; token: string; device: string;
}

export function loadState(): TripState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
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
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/persist.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/state/persist.ts app/src/state/persist.test.ts
git commit -m "feat: local persistence on the frozen storage keys"
```

---

### Task 4: The merge

**The highest-risk file in the project.** Transcribe the algorithm from the
legacy app at `index.html` (function `Sync.merge`). Do not simplify it, do not
"clean it up", do not change the tombstone handling. Add types only.

**Files:**
- Create: `app/src/state/sync/merge.ts`
- Test: `app/src/state/sync/merge.test.ts`

**Interfaces:**
- Consumes: `TripState`, `SYNCED`, `BY_ID` from `../schema`
- Produces: `merge(local: TripState, remote: TripState): TripState`,
  `touch(state, section, key): void`

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/state/sync/merge.test.ts
import { expect, test } from 'vitest';
import { merge, touch } from './merge';
import { emptyState, type TripState } from '../schema';
import fixture from '../__fixtures__/state.json';

const at = (s: TripState, sec: string, key: string, t: number) => {
  s._t = s._t || {}; s._t[`${sec}:${key}`] = t;
};

test('a production-shaped state survives a merge against itself unchanged', () => {
  const real = { ...emptyState(), ...(fixture as unknown as TripState) };
  const out = merge(real, real);
  expect(Object.keys(out.photos)).toHaveLength(2);
  expect(out.notes['8']).toBe('Sample note one');
  expect(out.notes['16']).toBe('Sample note two');
  // the tombstone from the fixture must survive the round trip
  expect(out._t!['done:0.7']).toBe(1785861151217);
});

test('two devices editing different fields both keep their work', () => {
  const a = emptyState(); a.notes['1'] = 'kenny';  at(a, 'notes', '1', 100);
  const b = emptyState(); b.notes['2'] = 'hersh';  at(b, 'notes', '2', 100);
  const out = merge(a, b);
  expect(out.notes['1']).toBe('kenny');
  expect(out.notes['2']).toBe('hersh');
});

test('the same field edited on both devices resolves to the newer edit', () => {
  const a = emptyState(); a.notes['1'] = 'older'; at(a, 'notes', '1', 100);
  const b = emptyState(); b.notes['1'] = 'newer'; at(b, 'notes', '1', 200);
  expect(merge(a, b).notes['1']).toBe('newer');
});

test('a deletion propagates instead of being resurrected by the other device', () => {
  const a = emptyState();                          at(a, 'notes', '1', 200);
  const b = emptyState(); b.notes['1'] = 'stale';  at(b, 'notes', '1', 100);
  const out = merge(a, b);
  expect(out.notes['1']).toBeUndefined();
  expect(out._t!['notes:1']).toBe(200);
});

test('a tombstone survives when the key is gone from both sides', () => {
  const a = emptyState(); at(a, 'done', '0.7', 500);
  const b = emptyState(); at(b, 'done', '0.7', 400);
  expect(merge(a, b)._t!['done:0.7']).toBe(500);
});

test('id-keyed arrays merge per item and stay sorted by date', () => {
  const a = emptyState();
  a.bookings = [{ id:'x', type:'stay', name:'Zion', date:'2026-09-28' }];
  at(a, 'bookings', 'x', 100);
  const b = emptyState();
  b.bookings = [{ id:'y', type:'stay', name:'Canmore', date:'2026-09-18' }];
  at(b, 'bookings', 'y', 100);
  const out = merge(a, b);
  expect(out.bookings.map(x => x.name)).toEqual(['Canmore', 'Zion']);
});

test('touch stamps the section:key the merge reads', () => {
  const s = emptyState();
  touch(s, 'notes', '4');
  expect(s._t!['notes:4']).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd app && bun run vitest run src/state/sync/merge.test.ts`
Expected: FAIL — cannot resolve `./merge`.

- [ ] **Step 3: Write `app/src/state/sync/merge.ts`**

```ts
import { SYNCED, BY_ID, type TripState } from '../schema';

type Bag = Record<string, unknown>;

/** Per-field last-write-wins. Every field carries its own timestamp in `_t`,
 *  so two devices editing different things both keep their work. Keys known
 *  only through a tombstone are included so deletions survive the round trip.
 *
 *  Transcribed from the legacy single-file app. Behaviour is deliberately
 *  identical; only types were added. */
export function merge(local: TripState, remote: TripState): TripState {
  const lt = local._t || {}, rt = remote._t || {};
  const out: Bag = { _t: {} as Record<string, number> };
  const outT = out._t as Record<string, number>;
  const stamp = (s: string, k: string, t: number) => { outT[`${s}:${k}`] = t; };

  for (const sec of SYNCED) {
    const isArr = (BY_ID as readonly string[]).includes(sec);
    // `||`, NOT `??`. The original falls back on ANY falsy section, so a
    // corrupt remote state.json holding `"bookings": 0` degrades to empty
    // instead of throwing mid-sync. `??` only catches null/undefined and
    // would abort the whole sync on a payload the original survives.
    const L = (local as Bag)[sec] || (isArr ? [] : {});
    const R = (remote as Bag)[sec] || (isArr ? [] : {});
    const lmap: Bag = isArr
      ? Object.fromEntries(((L || []) as { id: string }[]).map(o => [o.id, o]))
      : (L as Bag);
    const rmap: Bag = isArr
      ? Object.fromEntries(((R || []) as { id: string }[]).map(o => [o.id, o]))
      : (R as Bag);

    const keys = new Set([...Object.keys(lmap || {}), ...Object.keys(rmap || {})]);
    const pre = sec + ':';
    for (const tm of [lt, rt])
      for (const p of Object.keys(tm))
        if (p.indexOf(pre) === 0) keys.add(p.slice(pre.length));

    const merged: Bag = {};
    keys.forEach(k => {
      const p = `${sec}:${k}`, a = lt[p] || 0, b = rt[p] || 0;
      const hasL = Object.prototype.hasOwnProperty.call(lmap, k);
      const hasR = Object.prototype.hasOwnProperty.call(rmap, k);
      let win: unknown, wt: number;
      if (hasL && hasR) { win = a >= b ? lmap[k] : rmap[k]; wt = Math.max(a, b); }
      else if (hasL) {
        if (b > a && b > 0) { stamp(sec, k, b); return; }  // remote deleted it later
        win = lmap[k]; wt = a;
      } else if (hasR) {
        if (a > b && a > 0) { stamp(sec, k, a); return; }  // local deleted it later
        win = rmap[k]; wt = b;
      } else { stamp(sec, k, Math.max(a, b)); return; }    // gone both sides, keep tombstone
      if (win === undefined || win === null) { stamp(sec, k, Math.max(a, b)); return; }
      merged[k] = win; stamp(sec, k, wt || Date.now());
    });

    out[sec] = isArr ? Object.values(merged) : merged;
  }

  const bookings = out.bookings as { date: string }[] | undefined;
  if (bookings) bookings.sort((x, y) => (x.date < y.date ? -1 : 1));
  return out as unknown as TripState;
}

/** Stamp a change so the merge knows what is newest. Must be called on every
 *  mutation, or that edit will silently lose to the other device. */
export function touch(s: TripState, section: string, key: string | number): void {
  s._t = s._t || {};
  s._t[`${section}:${key}`] = Date.now();
}
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/sync/merge.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/state/sync/merge.ts app/src/state/sync/merge.test.ts
git commit -m "feat: port the per-field merge, tested against production state"
```

---

### Task 5: GitHub API client

**Files:**
- Create: `app/src/state/sync/github.ts`
- Test: `app/src/state/sync/github.test.ts`

**Interfaces:**
- Consumes: `SyncConfig` from `../persist`
- Produces: `GitHubRepo` class with `getFile(path)`, `putFile(path, b64, sha, msg)`,
  `getBlob(sha)`, `testAccess()`; `encodeUtf8(s)`, `decodeUtf8(b64)`;
  `ConflictError`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/state/sync/github.test.ts
import { expect, test, vi } from 'vitest';
import { GitHubRepo, encodeUtf8, decodeUtf8, ConflictError } from './github';

const cfg = { owner:'o', repo:'r', branch:'main', token:'t', device:'d' };

test('base64 helpers survive non-ASCII', () => {
  const s = 'Sample note two — café ☕';
  expect(decodeUtf8(encodeUtf8(s))).toBe(s);
});

test('a missing file reads as null rather than throwing', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false }) as never;
  expect(await new GitHubRepo(cfg).getFile('data/state.json')).toBeNull();
});

test('an expired token produces an actionable message', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false }) as never;
  await expect(new GitHubRepo(cfg).getFile('x')).rejects.toThrow(/expired/i);
});

test('a 409 from a concurrent write is typed as a conflict', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 409, ok: false }) as never;
  await expect(new GitHubRepo(cfg).putFile('x', 'AA==', null, 'm'))
    .rejects.toBeInstanceOf(ConflictError);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd app && bun run vitest run src/state/sync/github.test.ts`
Expected: FAIL — cannot resolve `./github`.

- [ ] **Step 3: Write `app/src/state/sync/github.ts`**

```ts
import type { SyncConfig } from '../persist';

export class ConflictError extends Error {
  constructor() { super('Both phones are syncing at once'); }
}

export function encodeUtf8(s: string): string {
  const b = new TextEncoder().encode(s);
  let out = ''; b.forEach(c => { out += String.fromCharCode(c); });
  return btoa(out);
}
export function decodeUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(a);
}

export interface ContentsResponse { content?: string; sha?: string; encoding?: string }

export class GitHubRepo {
  constructor(private cfg: SyncConfig) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
  private url(path: string) {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${path}`;
  }

  async getFile(path: string): Promise<ContentsResponse | null> {
    const ref = encodeURIComponent(this.cfg.branch || 'main');
    const r = await fetch(`${this.url(path)}?ref=${ref}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (r.status === 401) throw new Error('Token rejected — check it has not expired.');
    if (r.status === 403) throw new Error('Access denied — the token needs Contents: Read and write.');
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    return r.json();
  }

  /** The Contents API returns no body for blobs over 1 MB. This does. */
  async getBlob(sha: string): Promise<string | null> {
    const r = await fetch(
      `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/git/blobs/${sha}`,
      { headers: this.headers() });
    if (!r.ok) return null;
    return (await r.json()).content ?? null;
  }

  async putFile(path: string, b64: string, sha: string | null, msg: string) {
    const body: Record<string, unknown> = {
      message: msg, content: b64, branch: this.cfg.branch || 'main',
    };
    if (sha) body.sha = sha;
    const r = await fetch(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.status === 409 || r.status === 422) throw new ConflictError();
    if (!r.ok) {
      let d = ''; try { d = (await r.json()).message || ''; } catch { /* body not JSON */ }
      throw new Error(`Write failed (${r.status}) ${d}`);
    }
    return r.json();
  }

  async testAccess(): Promise<true> {
    const ref = encodeURIComponent(this.cfg.branch || 'main');
    const r = await fetch(`${this.url('')}?ref=${ref}`, { headers: this.headers() });
    if (r.status === 404) throw new Error('Repository not found — check the owner and name.');
    if (r.status === 401) throw new Error('Token rejected — check it has not expired.');
    if (r.status === 403) throw new Error('Access denied — needs Contents: Read and write.');
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    return true;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/sync/github.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/state/sync/github.ts app/src/state/sync/github.test.ts
git commit -m "feat: GitHub contents client with Blobs API fallback"
```

---

### Task 6: Photo sync

**Files:**
- Create: `app/src/state/sync/photos.ts`
- Test: `app/src/state/sync/photos.test.ts`

**Interfaces:**
- Consumes: `GitHubRepo` from `./github`; `idbGet`/`idbKeys`/`idbDel` from `../persist`;
  `PhotoRef`, `TripState` from `../schema`
- Produces: `collectRefs(state): PhotoRef[]`, `uploadPending(repo, state): Promise<number>`,
  `resolveRef(repo, ref): Promise<Blob|null>`, `sweepOrphans(state): Promise<number>`,
  `PHOTO_DIR`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/state/sync/photos.test.ts
import { expect, test } from 'vitest';
import { collectRefs, PHOTO_DIR } from './photos';
import { emptyState } from '../schema';

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
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd app && bun run vitest run src/state/sync/photos.test.ts`
Expected: FAIL — cannot resolve `./photos`.

- [ ] **Step 3: Write `app/src/state/sync/photos.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/sync/photos.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/state/sync/photos.ts app/src/state/sync/photos.test.ts
git commit -m "feat: photo sync with >1MB fallback and orphan sweep"
```

---

### Task 7: The store and sync engine

Carries over the durability fixes shipped to the legacy app in `644c8d8`:
debounced push on save, flush on backgrounding, an interval registered
unconditionally, and a capped conflict retry.

**Files:**
- Create: `app/src/state/store.ts`
- Test: `app/src/state/store.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces: `store` singleton with `getState()`, `subscribe(fn)`,
  `mutate(section, key, fn)`, `sync(silent?)`, `nudge()`, `flush()`,
  `startAuto()`, `status()`; `useTripState()` React hook

- [ ] **Step 1: Write the failing test**

```ts
// app/src/state/store.test.ts
import { expect, test, beforeEach, vi } from 'vitest';
import { store } from './store';

beforeEach(() => { localStorage.clear(); store.reset(); });

test('a mutation stamps _t so the merge can see it', () => {
  store.mutate('notes', '5', s => { s.notes['5'] = 'hello'; });
  expect(store.getState()._t!['notes:5']).toBeGreaterThan(0);
});

test('a mutation persists to the frozen key', () => {
  store.mutate('notes', '5', s => { s.notes['5'] = 'hello'; });
  expect(JSON.parse(localStorage.getItem('larchcanyon')!).notes['5']).toBe('hello');
});

test('subscribers are notified once per mutation', () => {
  const fn = vi.fn();
  store.subscribe(fn);
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  expect(fn).toHaveBeenCalledTimes(1);
});

test('a failed write is reported in status rather than swallowed', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => { throw new Error('QuotaExceededError'); });
  store.mutate('notes', '5', s => { s.notes['5'] = 'x'; });
  expect(store.status().saveFailed).toBe(true);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd app && bun run vitest run src/state/store.test.ts`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Write `app/src/state/store.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `cd app && bun run vitest run src/state/store.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Wire the lifecycle handlers in `app/src/main.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './state/store';

store.startAuto();
window.addEventListener('online', () => void store.sync(true));
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { store.flush(); return; }
  void store.sync(true);
});

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 6: Commit**

```bash
git add app/src/state/store.ts app/src/state/store.test.ts app/src/main.tsx
git commit -m "feat: store and sync engine with durable push semantics"
```

---

### Task 8: Self-hosted fonts and design tokens

Fixes the offline typography collapse: the legacy app loads Bricolage
Grotesque, Inter and JetBrains Mono from `fonts.googleapis.com`, and its service
worker only caches same-origin responses, so the type falls back to system-ui
wherever there is no signal.

**Files:**
- Create: `app/src/assets/fonts/*.woff2`
- Create: `app/src/styles/tokens.css`, `app/src/styles/base.css`
- Modify: `app/src/main.tsx` (import the stylesheets)

> **Fonts go in `src/assets/`, not `public/`.** Anything in `public/` must be
> referenced by an absolute URL containing the Vite `base`, which is
> `/honeymoon/next/` today and becomes `/honeymoon/` at cutover — hardcoding it
> would silently break every font at the moment of the switch. Referenced from
> `src/` with a relative URL, Vite rewrites and fingerprints them, and the paths
> stay correct at any base.

**Interfaces:**
- Consumes: nothing
- Produces: CSS custom properties `--ink`, `--ink-2`, `--paper`, `--card`,
  `--larch`, `--canyon`, `--glacier`, `--stone`, `--line`, `--line-2`, `--ok`,
  `--warn`, `--sh`, `--d`, `--b`, `--m`

- [ ] **Step 1: Fetch the three font families as woff2**

```bash
mkdir -p app/public/fonts
cd app/public/fonts
for u in \
 "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" \
 "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" \
 "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" ; do
  curl -sH "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" "$u" \
   | grep -o 'https://[^)]*\.woff2' | sort -u | while read -r f; do
      curl -s -O "$f"
    done
done
ls -la
```

Expected: several `.woff2` files. Keep only the `latin` subsets — the trip has
no need for Cyrillic or Vietnamese ranges — and note their filenames for the
next step.

- [ ] **Step 2: Write `app/src/styles/tokens.css`**

Values are copied verbatim from the legacy app's `:root` block so the redesign
starts from the identical palette.

```css
/* Relative URLs, resolved from this file's own location. Vite rewrites and
   fingerprints them, so they stay correct when `base` changes at cutover.
   An absolute /honeymoon/next/… path would break at that moment. */
@font-face{font-family:'Bricolage Grotesque';src:url('../assets/fonts/bricolage-latin.woff2') format('woff2');
  font-weight:400 800;font-display:swap;unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'Inter';src:url('../assets/fonts/inter-latin.woff2') format('woff2');
  font-weight:400 600;font-display:swap;unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'JetBrains Mono';src:url('../assets/fonts/jetbrains-latin.woff2') format('woff2');
  font-weight:400 600;font-display:swap;unicode-range:U+0000-00FF,U+2000-206F}

:root{
  --ink:#1B2A24; --ink-2:#31423A; --paper:#FBF9F4; --card:#FFFFFF;
  --larch:#D9A441; --canyon:#B4593A; --glacier:#3F7285; --stone:#6E7A73;
  --line:#E2E0D6; --line-2:#CFCEC2; --ok:#4A7C59; --warn:#C4791F;
  --sh:0 1px 2px rgba(27,42,36,.05),0 4px 14px rgba(27,42,36,.05);
  --d:'Bricolage Grotesque',system-ui,sans-serif;
  --b:'Inter',system-ui,-apple-system,sans-serif;
  --m:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --tap:44px;
}
```

Rename the downloaded files to match these three paths.

- [ ] **Step 3: Write `app/src/styles/base.css`**

```css
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
html,body{margin:0;padding:0;overscroll-behavior:none}
body{background:var(--paper);color:var(--ink);font-family:var(--b);
  font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:var(--d);margin:0;letter-spacing:-.015em;line-height:1.1}
button{cursor:pointer;border:none;background:none;font:inherit;color:inherit}
/* iOS zooms the page when focusing an input under 16px */
input,select,textarea{font-family:inherit;font-size:16px;color:inherit}
/* chrome only — never on content the user may want to copy */
header,nav{user-select:none;-webkit-user-select:none}
/* every interactive control clears the platform minimum */
button,a[role=button],input[type=checkbox]{min-height:var(--tap);min-width:var(--tap)}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 4: Import both from `app/src/main.tsx`**

Add above the existing imports:

```tsx
import './styles/tokens.css';
import './styles/base.css';
```

- [ ] **Step 5: Verify the fonts are bundled and self-referenced**

Run: `cd app && bun run vite build && grep -r "fonts.googleapis" dist/ | wc -l`
Expected: `0`. Any hit means a font is still being fetched from Google and the
offline bug survives.

- [ ] **Step 6: Commit**

```bash
git add app/public/fonts app/src/styles app/src/main.tsx
git commit -m "feat: self-host fonts and lift the design tokens"
```

---

### Task 9: End-to-end smoke test

**Files:**
- Create: `app/e2e/smoke.spec.ts`, `app/playwright.config.ts`
- Modify: `app/package.json` (scripts)

**Interfaces:**
- Consumes: the built output in `app/dist`
- Produces: `bun run e2e`

- [ ] **Step 1: Install Playwright**

```bash
cd app && bun add -d @playwright/test && bunx playwright install chromium
```

- [ ] **Step 2: Write `app/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173/honeymoon/next/' },
  webServer: { command: 'bun run vite preview --port 4173', port: 4173, reuseExistingServer: true },
});
```

- [ ] **Step 3: Write the failing test**

```ts
// app/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('state written by the legacy app is readable and survives a reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('larchcanyon', JSON.stringify({
      notes: { '8': 'Sample note one' },
      _t: { 'notes:8': 1785862471786 },
    }));
  });
  await page.goto('./');
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('larchcanyon')!).notes['8']);
  expect(before).toBe('Sample note one');

  await page.evaluate(() => localStorage.setItem('larchcanyon',
    JSON.stringify({ ...JSON.parse(localStorage.getItem('larchcanyon')!),
      notes: { '8': 'edited' } })));
  await page.reload();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('larchcanyon')!).notes['8']);
  expect(after).toBe('edited');
});

test('no request ever leaves for Google Fonts', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (r.url().includes('fonts.g')) external.push(r.url()); });
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});
```

- [ ] **Step 4: Add scripts to `app/package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 5: Run the suite**

Run: `cd app && bun run build && bun run e2e`
Expected: 2 passed.

- [ ] **Step 6: Run everything and commit**

```bash
cd app && bun run test && bun run build && bun run e2e
git add app/e2e app/playwright.config.ts app/package.json
git commit -m "test: end-to-end smoke over the built output"
```

---

## Definition of done

- `bun run test` passes: 27 unit tests across schema, persist, merge, github,
  photos, store
- `bun run e2e` passes
- `https://nocturnowll.github.io/honeymoon/` still serves `BUILD='2026.08.07-4'`
  — the legacy app, undisturbed
- `https://nocturnowll.github.io/honeymoon/next/` returns 200
- `grep -r "fonts.googleapis" app/dist/` returns nothing

## What this plan deliberately does not do

- Draw any screen beyond a placeholder — that is Plan 2
- Port `fx.ts` or `dates.ts`. The spec names both as test targets; they belong
  with the screens that consume them — FX with Budget, dates with Now and
  Itinerary — and land in Plan 2 with their tests
- Touch the map or the bookings model — that is Plan 3
- Move the SPA to `/honeymoon/` — that is the cutover, at the end of Plan 3,
  and it is a one-line change to `_site` assembly in the deploy workflow
