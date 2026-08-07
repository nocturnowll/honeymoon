# Larch & Canyon Map, Bookings and Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the offline vector trip map, fix the bookings model so a multi-night stay is one booking, replace the hand-written service worker, and cut the SPA over to `/honeymoon/`.

**Architecture:** The map renders from small public-domain GeoJSON with the 12 `LOC` pins already in the trip data — no tile server, no network. Bookings gain an optional `end` date and attachments, both additive so an older build ignores them. Cutover is a deliberate, reversible sequence at the end.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Bun 1.3.13, Vitest, Playwright, `vite-plugin-pwa`.

## Global Constraints

- **Bun only.** Never `npm`, `yarn`, `pnpm`.
- **This repo is PUBLIC.** No real trip data, tokens, addresses, confirmation numbers or card details in source, tests or fixtures.
- **Additive fields only.** `booking.end` and `booking.files` must be optional. During changeover one phone may still run the old build, which knows only `date` — it must keep working.
- **Storage keys frozen:** `larchcanyon`, `larchcanyon.gh`, `larchcanyon.fx`. IndexedDB `larchcanyon` v1, store `blobs`.
- **`VITE_SYNC_ENABLED` stays OFF until Task 8.** localStorage is per-origin, not per-path.
- Target ES2022. iOS Safari 16.4+.

---

### Task 1: Trip geometry

**Files:** Create `app/scripts/build-geo.ts`, `app/src/data/geo/*.json`, `app/src/lib/geo.ts`; Test `app/src/lib/geo.test.ts`

**Interfaces produced:** `project(lon, lat, view)`, `unproject(x, y, view)`, `fitBounds(points, size)`, `TRIP_BOUNDS`

- [ ] **Step 1: Source the geometry.** Natural Earth, public domain: coastline and `admin_1_states_provinces_lines` (US + Canada) at 1:50m. **Roads are only published at 1:10m** — if you want them, take `ne_10m_roads` and clip hard, or drop roads entirely and report that you did. Do not stall hunting for a 1:50m roads layer; it does not exist. Bounding box covering all 12 bases with padding: roughly **lon −124 to −110, lat 33 to 52**.
- [ ] **Step 2: Reduce it.** A build script that clips to the bbox, simplifies (Douglas–Peucker, tolerance tuned by eye), rounds coordinates to 4 decimal places, and writes compact GeoJSON. **Target ≤200KB total** — smaller than the 608KB of PNGs it replaces. Record the actual sizes in the report.
- [ ] **Step 3: Define `BASES` — read this before writing any test.** Verified against `app/src/data/itinerary.ts` on 2026-08-08:

  - `LOC` holds **12** entries, all with `lat`/`lon`.
  - **`LOC` key order is NOT trip order.** `LOC` lists `sea, yyc, cmr, …`; the days run `sea, cmr, yyc, …` — Canmore before Calgary. Deriving the route from `Object.keys(LOC)` draws it wrong. **Trip order must come from `DAYS`**, taking each `base` in first-appearance order.
  - **`dvl` (Death Valley) appears in `LOC` but no day uses it as a base** — 11 of the 12 are overnight bases. It is a waypoint, not a stop.

  So export two things, and keep them distinct:

```ts
// Every pin worth drawing, including waypoints like Death Valley. Used by fitBounds.
export const BASES: { key: string; lon: number; lat: number }[] =
  Object.entries(LOC).map(([key, l]) => ({ key, lon: l.lon, lat: l.lat }));

// Overnight bases in the order the trip actually visits them. Used by the route polyline.
export const ROUTE: string[] = [...new Set(DAYS.map(d => d.base))];
```

  `BASES.length === 12`, `ROUTE.length === 11`, and `ROUTE` must not contain `dvl`. Assert all three.

- [ ] **Step 4: Projection maths.** Web Mercator, with tests:

```ts
test('projection round-trips a known coordinate', () => {
  const view = { cx: -118, cy: 37, zoom: 1, w: 390, h: 600 };
  const p = project(-118.244, 34.052, view);           // Los Angeles
  const back = unproject(p.x, p.y, view);
  expect(back.lon).toBeCloseTo(-118.244, 4);
  expect(back.lat).toBeCloseTo(34.052, 4);
});
test('fitBounds contains every trip base', () => {
  const view = fitBounds(BASES, { w: 390, h: 600 });
  for (const b of BASES) {
    const p = project(b.lon, b.lat, view);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(390);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(600);
  }
});
```
The bases span ~17° of latitude (Canmore 51.089 to LA 34.052), so a naive equirectangular fit distorts badly at the top. Mercator matters here.

Real extent, measured: lon **−122.419 → −111.456**, lat **34.052 → 51.089**. The bbox in Step 1 (−124…−110, 33…52) clears it with padding on every side.

- [ ] **Step 5:** Commit.

---

### Task 2: The map component

**Files:** Create `app/src/components/TripMap.tsx`, `app/src/components/MapPin.tsx`; Test `app/src/components/TripMap.test.tsx`

**Interfaces produced:** `<TripMap legs? bases? interactive? onPinTap? />`

- [ ] **Step 1:** Render base geometry as SVG paths, styled from the existing tokens — `--line-2` for borders, `--stone` for roads, `--paper` background. It should read as a drawn map, not a screenshot.
- [ ] **Step 2:** All **12** pins from `BASES`, plus a route polyline over **`ROUTE`** (the 11 overnight bases, in trip order). Death Valley gets a pin but the route does not detour through it. Do not iterate `LOC` for the route — see Task 1 Step 3.
- [ ] **Step 3:** Pinch-zoom and pan via pointer events. `touch-action: none` on the canvas only — not on the page, or the tab stops scrolling.
- [ ] **Step 4:** Tap a pin → callback with the base key. In the Map tab this navigates to the first day at that base.
- [ ] **Step 5:** Two sizes from one component: full (own tab) and mini (scoped to one leg, non-interactive, inside the itinerary place header). `interactive={false}` disables gestures.
- [ ] **Step 6:** Tests — pins land inside the viewport at default zoom; the route visits bases in trip order; a tap dispatches the right base key.
- [ ] **Step 7:** Commit.

---

### Task 3: Map tab, and retire the PNGs

**Files:** Create `app/src/routes/Map.tsx`; Modify `app/src/components/PlaceHeader.tsx`

- [ ] **Step 1:** Map tab — full-bleed map, legend, tap-through to days.
- [ ] **Step 2:** Replace the per-leg PNG slot in the itinerary with the mini map scoped to that leg, tappable to open the full tab.
- [ ] **Step 3:** The five PNGs under the repo root `assets/maps/` are still used by the **live** app. Do not delete them; they retire at cutover (Task 8) when the legacy app moves to `/legacy/`.
- [ ] **Step 4:** Record the size delta in the report — vector GeoJSON vs the 608KB of PNGs.
- [ ] **Step 5:** Commit.

---

### Task 4: Bookings — date ranges

Fixes the complaint that prompted this: a 14–16 Sep hotel is one booking, not one date, and the "unbooked nights" warning currently reports nights you have already paid for.

**Files:** Modify `app/src/state/schema.ts`, `app/src/components/BookingSheet.tsx`, `app/src/components/BookingList.tsx`, `app/src/components/DayCard.tsx`; Create `app/src/lib/bookings.ts`; Test `app/src/lib/bookings.test.ts`

**Interfaces produced:** `nightsCovered(b)`, `bookingsOnDate(bookings, iso)`, `unbookedNights(days, bookings)`

- [ ] **Step 1:** `end?: string` on `Booking` — optional, ISO `yyyy-mm-dd`. `date` remains the start. **Additive: an older build reads `date` and ignores `end`.**
- [ ] **Step 2:** Write the failing tests:

```ts
test('a stay spans every night from date to end, exclusive of checkout day', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' };
  expect(nightsCovered(b)).toEqual(['2026-09-14', '2026-09-15']);
});
test('a booking with no end covers a single night, as the old model did', () => {
  expect(nightsCovered({ id:'b', type:'stay', name:'X', date:'2026-09-14' }))
    .toEqual(['2026-09-14']);
});
test('a multi-night stay no longer reports its own nights as unbooked', () => {
  const days = [{d:'2026-09-14'},{d:'2026-09-15'},{d:'2026-09-16'}];
  const bookings = [{ id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' }];
  expect(unbookedNights(days, bookings)).toEqual(['2026-09-16']);
});
test('the banner appears on every night of a stay, not just the first', () => {
  const b = { id:'b', type:'stay', name:'X', date:'2026-09-14', end:'2026-09-16' };
  expect(bookingsOnDate([b], '2026-09-15')).toHaveLength(1);
});
```
Checkout day is deliberately excluded — you do not sleep there that night.

**Accepted divergence, do not "fix" it:** the live app keeps its exact-date match (`vBook`'s unbooked filter and `bookingBanner`), so while both builds coexist the legacy app will still over-report unbooked nights and show a stay's banner only on its first day. That is expected. The legacy app is not to be edited for this — it retires at cutover (Task 7). Its save path uses `Object.assign(b, o)`, which merges rather than replaces, so editing a booking there **preserves** `end` and `files` written by the SPA. Verified 2026-08-08.

- [ ] **Step 3:** Implement, then replace the exact-date match at `index.html:1110` (`b.date === d.d`) everywhere it appears in the SPA.
- [ ] **Step 4: Real date pickers.** `<input type="date">` for From and To, replacing the dropdown of 22 trip days. Do **not** restrict to trip dates — a booking may legitimately fall outside. Show the computed night count live.
- [ ] **Step 5:** Times (`checkin`/`checkout`) stay, but become optional and visually secondary.
- [ ] **Step 6:** Commit.

---

### Task 5: Bookings — attachments

**Files:** Modify `app/src/state/schema.ts`, `app/src/state/sync/photos.ts`, `app/src/components/BookingSheet.tsx`, `app/src/lib/image.ts`

- [ ] **Step 1:** `files?: PhotoRef[]` on `Booking`. `collectRefs` already walks `bookings[].files` — verify with a test that it does, since that path has never had a real payload.
- [ ] **Step 2:** Accept **PDF as well as image**. `processImage` (`index.html:903-920`) rejects non-images; PDFs must skip resizing and store the raw Blob. The extension logic in `uploadPending` already branches on `application/pdf`.
- [ ] **Step 3: Delete the stale warning.** The live app says *"PDFs are far too large for browser storage, so keep those in your email."* That was true when everything was base64 in localStorage's 5MB. Photos moved to IndexedDB; a 150KB Booking.com PDF is nothing. Remove the copy and the restriction.
- [ ] **Step 4:** Render an attachment as a thumbnail (image) or a labelled chip (PDF), opening via object URL. iOS renders PDFs natively — no PDF.js, no bundle cost.
- [ ] **Step 5:** Deleting a booking must release its attachment refs so `sweepOrphans` reclaims them. Test it.
- [ ] **Step 6:** Commit.

**Out of scope, stated so nobody attempts it:** auto-parsing a Booking.com email into fields. That needs OCR or an LLM, neither works offline, and the format changes without warning.

---

### Task 6: Service worker via `vite-plugin-pwa`

**Files:** Modify `app/vite.config.ts`; Create `app/public/manifest.webmanifest`

- [ ] **Step 1:** Add `vite-plugin-pwa` with a generated precache manifest. This removes the "forgot to bump `V`" failure mode that the hand-written `sw.js` has.
- [ ] **Step 2: Precache the fonts.** The whole reason Task 8 of Plan 1 self-hosted them was that the live service worker only caches same-origin responses. Verify the three woff2 files appear in the generated manifest — if they do not, the offline typography bug returns.
- [ ] **Step 3:** Runtime caching: never cache `api.github.com`, `open-meteo`, or `er-api.com`. Ported from `index.html`'s `sw.js:25-26`.
- [ ] **Step 4: Confirm the idb-harness is absent from the precache manifest.** It is gated out of production builds, but this is the mechanism that would have made an accidental inclusion permanent on every device.
- [ ] **Step 5:** Update prompt — "New version ready", skip waiting, reload. Ported from `index.html:2129-2145`.
- [ ] **Step 6:** Commit.

---

### Task 7: The `/legacy/` fallback

**Files:** Create `legacy/` at the repo root; Modify `.github/workflows/deploy.yml`

- [ ] **Step 1:** Copy the current live app — `index.html`, `sw.js`, `manifest.json`, `assets/` — into `legacy/` as a frozen snapshot. Do not modify the root copies yet; they are still serving.
- [ ] **Step 2:** Change `legacy/sw.js`'s cache name so it cannot collide with the SPA's Workbox caches on the same origin.
- [ ] **Step 3:** Workflow assembles `_site/legacy/` from `legacy/`.
- [ ] **Step 4:** Deploy and verify `/honeymoon/legacy/` serves the working old app while `/honeymoon/` is still the old app too. Both must work before Task 8.
- [ ] **Step 5:** Commit.

---

### Task 8: Cutover

**Do not start until Tasks 1-7 are complete, the full suite is green, and Kenny has agreed a time when both phones are together on wifi.**

- [ ] **Step 1:** Set `base` to `/honeymoon/` in `vite.config.ts`. The font URLs are relative and survive this; verify anyway with `grep -c "honeymoon/next" dist/` → 0.
- [ ] **Step 2:** Set **`VITE_SYNC_ENABLED=1`** in the workflow build step.

  This is the switch the entire foundation was gated behind. Until now `/honeymoon/next/` could not touch the data repo *because localStorage is per-origin, not per-path* — the SPA can see the live PAT and the live photo blobs. From this commit forward it will sync for real.

- [ ] **Step 3:** Workflow assembles: `_site/` from `app/dist` (the SPA at root), `_site/legacy/` from `legacy/`. Remove the `_site/next/` step and the root `cp` of the old files.
- [ ] **Step 4:** Deploy. Verify `/honeymoon/` serves the SPA and `/honeymoon/legacy/` still serves the old app.
- [ ] **Step 5: On both phones, together, on wifi:** force-quit, reopen, then check —
  - sync chip green
  - all photos present
  - both of Hershania's notes intact
  - bookings, cards and spend all present
  - make an edit on one phone and watch it land on the other
- [ ] **Step 6:** Only once that passes, delete the root `assets/maps/*.png` — the vector map replaced them.
- [ ] **Step 7:** Commit and tag.

**Rollback, at any point:** `git revert` the cutover commit and push, or open `/honeymoon/legacy/`. Data is untouched by either — it lives in localStorage and IndexedDB, which no deploy can reach.

---

## Definition of done

- `bun run test`, `bun run e2e`, `bunx tsc --noEmit` all clean
- `/honeymoon/` serves the SPA; `/honeymoon/legacy/` serves the old app
- Both phones synced, all photos and notes verified present after cutover
- Vector map works with the network disabled
- A multi-night stay shows on every night and no longer false-alarms as unbooked
- Total geometry ≤200KB, replacing 608KB of PNGs

## Known risks

- **Cutover is the only irreversible-feeling step.** It is not actually irreversible — `/legacy/` and `git revert` both stand — but it is the moment both phones change. Do it together, on wifi, not the night before flying.
- **The Budget screen** carries the most logic and got a full redesign in Plan 2. Its manual side-by-side gate is the real check.
- **`uploadPending` / `resolveRef` / `sweepOrphans`** are still only covered by the four raw `idb*` primitives in the e2e harness. Plan 2 Task 4 wires them; a Playwright test covering both `sweepOrphans` branches is the cheapest way to close this, and the harness scaffolding already exists.
