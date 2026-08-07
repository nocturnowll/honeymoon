# Larch & Canyon Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Plan 1 foundation into a usable five-tab application — Now, Itinerary, Budget, Lists, Map placeholder — redesigned, with sync still gated off.

**Architecture:** React screens over the ported data layer. Every screen reads through `useTripState()` and writes only through `store.mutate()`, which stamps `_t` and schedules a push. Business logic (`fx`, `dates`) is ported from the live `index.html` verbatim and unit-tested before any screen consumes it.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Bun 1.3.13, Vitest, Playwright.

## Global Constraints

- **Bun only.** Never `npm`, `yarn`, `pnpm`.
- **The live app must keep working.** Nothing modifies `index.html`, `sw.js`, `manifest.json` or `assets/` at the repository root. Those serve `/honeymoon/`.
- **This repo is PUBLIC.** Never commit real trip data, tokens, addresses, confirmation numbers or card details. Fixtures are production-*shaped* with fabricated content. `**/state.real.json` is gitignored.
- **`VITE_SYNC_ENABLED` stays OFF.** localStorage is per-origin, not per-path — `/honeymoon/next/` sees the live PAT and live photo blobs. It is flipped on in Plan 3, at cutover, and not before.
- **Storage keys frozen:** `larchcanyon`, `larchcanyon.gh`, `larchcanyon.fx`. IndexedDB `larchcanyon` v1, store `blobs`.
- **Design tokens are already lifted** into `app/src/styles/tokens.css` and match the live app exactly. Use the custom properties; do not introduce new hex values.
- **44px minimum tap target** (`--tap`). The live app's 21px checkbox is the most-used control in the app.
- Vite `base` is `/honeymoon/next/`. Target ES2022. iOS Safari 16.4+.

## Porting rule

Where a task says "port from `index.html:NNNN`", transcribe the logic and add
types. Do not improve it. That file is the running application and its
behaviour is the specification. If something looks like a bug, write it in the
report and leave it — this rule caught a real divergence in Plan 1 (`??` vs
`||`) that would have aborted sync on a corrupt payload.

---

### Task 1: Correct the Spend and Card schemas

**These are wrong in `main` today.** `schema.ts` was written from the plan rather than from the live app, and two interfaces drifted. `S.spend` and `S.cards` are both empty in production right now, so nothing is lost — but the Budget tab is the one used daily on the road, and a card entered in the legacy app would read back `undefined` in the SPA.

**Files:** Modify `app/src/state/schema.ts`; Test `app/src/state/schema.test.ts`

**Interfaces produced:** corrected `Spend`, `Card`

- [ ] **Step 1: Read the ground truth**

`index.html:1918-1951` (`spendSheet`) writes:
```js
S.spend.push({id, what, amt, cur, card, date})
```
`index.html:1890-1917` (`cardSheet`) writes:
```js
{id, type, nick, bank, network, holder, last4, markup, fee, limit}
```
where `type` is `'cash'` or a card type, and for cash entries `limit` holds the amount being carried.

- [ ] **Step 2: Write the failing test**

```ts
test('Spend matches the field names the live app writes', () => {
  const s: Spend = { id:'s1', what:'Dinner', amt:42.5, cur:'USD', card:'c1', date:'2026-09-20' };
  expect(s.amt).toBe(42.5);
});

test('Card matches the field names the live app writes, including cash entries', () => {
  const c: Card = { id:'c1', type:'visa', nick:'Main', bank:'BCA', network:'visa',
    holder:'K E', last4:'1234', markup:2.5, fee:0, limit:5000 };
  expect(c.nick).toBe('Main');
  const cash: Card = { id:'c2', type:'cash', nick:'USD cash', limit:800, markup:0, fee:0 };
  expect(cash.type).toBe('cash');
});
```

- [ ] **Step 3: Correct the interfaces**

```ts
export interface Spend {
  id: string; date: string; cur: string;
  amt: number;              // NOT `amount` — index.html:1946 writes `amt`
  card?: string; what?: string;
}

export interface Card {
  id: string;
  type: string;             // 'cash' or a card network type
  nick: string;             // NOT `name` — index.html:1905 writes `nick`
  bank?: string; network?: string; holder?: string; last4?: string;
  markup?: number; fee?: number;
  limit?: number;           // credit limit, or the amount carried when type==='cash'
}
```

- [ ] **Step 4:** `cd app && bun run vitest run src/state/schema.test.ts` — all pass.
- [ ] **Step 5:** Commit: `fix: correct Spend and Card against the live app's field names`

---

### Task 2: Port `dates.ts` and `fx.ts`

Deferred from Plan 1 because they belong with the screens that consume them. Both are timezone- and money-sensitive, which is why they are tested before any screen uses them.

**Files:** Create `app/src/lib/dates.ts`, `app/src/lib/dates.test.ts`, `app/src/lib/fx.ts`, `app/src/lib/fx.test.ts`

**Interfaces produced:**
- `dates.ts`: `dObj(s)`, `dLabel(s)`, `dShort(s)`, `todayISO()`, `daysBetween(a,b)`, `mins(t)`, `itemKey(di,si)`, `tripPhase()`, `currentDayIdx()`
- `fx.ts`: `FX` object with `load()`, `refresh(force?)`, `idr(cur)`, `age()`, `FALLBACK`; and `cardRate(card, cur)`

- [ ] **Step 1: Port from the live app**

`dates.ts` from `index.html:844-858` (`dObj` through `tripPhase`). Note `dObj` deliberately parses `y-m-d` into a **local** `new Date(y, m-1, d)` rather than `Date.parse`, which would treat it as UTC and shift the day. Keep that.

`fx.ts` from `index.html:771-830` (`FX` and `cardRate`). Keep the `larchcanyon.fx` cache key, the 6-hour refresh threshold, the `open.er-api.com` endpoint, and the `FALLBACK` rates.

- [ ] **Step 2: Write the failing tests**

Dates — the ones that actually bite:
```ts
test('a date string parses as local, not UTC', () => {
  // Date.parse('2026-09-14') is UTC midnight; west of Greenwich that is the 13th
  expect(dObj('2026-09-14').getDate()).toBe(14);
});
test('daysBetween spans the trip correctly', () => {
  expect(daysBetween('2026-09-14', '2026-10-06')).toBe(22);
});
test('tripPhase reports before / during / after around the real trip dates', () => {
  // freeze the clock with vi.setSystemTime for each case
});
test('mins parses a schedule time to minutes past midnight', () => {
  expect(mins('14:30')).toBe(870);
});
```

FX — the money maths:
```ts
test('idr converts a non-USD currency via the USD cross rate', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(FX.idr('USD')).toBe(16500);
  expect(FX.idr('IDR')).toBe(1);
  expect(FX.idr('CAD')).toBeCloseTo(16500 / 1.37, 6);
});
test('an unknown currency falls back to the USD rate rather than NaN', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(FX.idr('JPY')).toBe(16500);
});
test('cardRate adds the bank markup and any flat fee on top of mid-market', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  const c = { id:'c', type:'visa', nick:'x', markup: 2.5, fee: 0.5 };
  expect(cardRate(c, 'USD')).toBeCloseTo(16500 * 1.03, 6);
});
test('a card with no markup costs mid-market', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(cardRate({ id:'c', type:'visa', nick:'x' }, 'USD')).toBe(16500);
});
```

- [ ] **Step 3:** Implement, run, confirm green, commit.

---

### Task 3: App shell — routing, nav, header, error boundaries

**Files:** Create `app/src/App.tsx` (replace the placeholder), `app/src/components/Nav.tsx`, `app/src/components/Header.tsx`, `app/src/components/SyncChip.tsx`, `app/src/components/ErrorBoundary.tsx`, `app/src/lib/router.ts`; Test `app/src/lib/router.test.ts`

**Interfaces produced:** `useRoute()` returning `{ tab, params }`, `navigate(hash)`; `<ErrorBoundary>`

- [ ] **Step 1: Hash routing**

Routes: `#/now` (default), `#/itinerary`, `#/itinerary/day/:idx`, `#/budget`, `#/lists`, `#/map`. Hash routing because Pages serves from a subpath and the app runs standalone — a path router 404s on refresh. Subscribe to `hashchange`; no router library.

- [ ] **Step 2: Five-tab nav**

Now · Itinerary · Budget · Lists · Map. Icons ported from `index.html:895-902` (`ICONS`). Each button ≥44px. `nav { user-select: none }` is already in `base.css`. Bottom-fixed with `env(safe-area-inset-bottom)` as the live app does at `index.html:60-70`.

- [ ] **Step 3: Header**

Brand, trip countdown or day-N (from `tripPhase()`), the sync chip, and a gear opening settings. Port the chip states from `index.html:1330-1337`, plus `not saved` when `store.status().saveFailed`.

**The chip must show a distinct disabled state while `VITE_SYNC_ENABLED` is off** — otherwise the SPA looks like it is syncing when it structurally cannot. Use `sync off` in the neutral style.

- [ ] **Step 4: Error boundary per route**

One broken screen must not white-screen the app in a canyon. Fallback shows the error and a "back to Now" button. Test that a throwing child renders the fallback and the rest of the shell survives.

- [ ] **Step 5:** Tests for the router (hash parse/format round trip, unknown route falls back to `now`), commit.

---

### Task 4: Complete the sync engine — photo download and boot sync

Plan 1's final review flagged both. `resolveRef` is written, exported, and imported nowhere: there is **no photo download half**, so the partner's photos would never reach the device. And there is no sync-on-boot, which the legacy app has at `index.html:2144`.

Both are prerequisites for any screen that renders a photo. Sync stays gated off; this is wiring, not activation.

**Files:** Modify `app/src/state/store.ts`; Test `app/src/state/store.test.ts`

**Interfaces produced:** `store.hydratePhotos()`, `store.photoUrl(ref)`; boot sync inside `startAuto()` or an explicit `store.boot()`

- [ ] **Step 1:** Port `hydratePhotos` from `index.html:1384-1394` — collect refs, resolve any not already in `Photos.url`, return whether anything arrived. Call it in `sync()` after the merge is persisted and **before** `sweepOrphans`, matching the legacy order at `index.html:1382`.
- [ ] **Step 2:** Object-URL cache: an id → `URL.createObjectURL` map created once, revoked on removal. Port from `index.html:660-700` (`Photos`).
- [ ] **Step 3:** Boot sync — on `store.boot()`, if configured and online, run one sync immediately rather than waiting up to five minutes.
- [ ] **Step 4:** Tests — `hydratePhotos` requests only refs not already local; boot sync fires once when configured; **neither fires while `syncEnabled` is false**. That last one guards the Plan 1 Critical.
- [ ] **Step 5:** Commit.

---

### Task 5: Now screen

The daily driver. Answers one question — what is happening now and next.

**Files:** Create `app/src/routes/Now.tsx`, `app/src/components/NowRail.tsx`, `app/src/components/WeatherStrip.tsx`, `app/src/lib/weather.ts`

- [ ] **Step 1:** Port `WX` and `loadWeather` from `index.html:859-885` and `1009-1047`. Open-Meteo, cached, seasonal averages before ~30 Aug and live after. Keep the `est` flag and the "seasonal averages" note.
- [ ] **Step 2:** Port `tripPhase` branches from `vNow` (`index.html:945-976`): before → countdown + next todos; during → current item, next item, day N of 22; after → a closing state.
- [ ] **Step 3:** Port `nowRail` (`index.html:992-1008`) — the signature element. Current schedule item prominent, next beneath.
- [ ] **Step 4:** Today's bookings, including the check-in-versus-arrival warning from `index.html:1088-1099`. That warning is genuinely useful and must survive the redesign.
- [ ] **Step 5:** The 60-second re-render while `tripPhase().p === 'during'` (`index.html:2149`) becomes a React interval, cleaned up on unmount.
- [ ] **Step 6:** Commit.

---

### Task 6: Itinerary — date rail, place headers, day cards

The screen this rewrite was requested for. Structure is leg → place → days.

**Files:** Create `app/src/routes/Itinerary.tsx`, `app/src/components/DateRail.tsx`, `app/src/components/PlaceHeader.tsx`, `app/src/components/DayCard.tsx`, `app/src/components/ScheduleItem.tsx`, `app/src/components/OutfitCard.tsx`; Create `app/src/data/itinerary.ts`

- [ ] **Step 1: Lift the trip data.** Move `DAYS`, `LOC`, `TRIP`, `PACKING`, `TODOS` out of `index.html` (lines 278-843) into `app/src/data/itinerary.ts`, typed. This is static trip content, not user data — it is already public in the live app.
- [ ] **Step 2: Date rail.** Horizontally scrolling day chips pinned under the leg name, current day marked, tap to jump. Must scroll the selected chip into view on mount so day 14 is not off-screen.
- [ ] **Step 3: Sticky headers.** Leg name sticky at top; the day header sticky while its own day scrolls. Two stacked sticky levels — verify on a real viewport that they do not overlap.
- [ ] **Step 4: Place header, carrying the outfit.** `S.outfits` is keyed by **base location** (`yos`, `zio`, `cmr`), not by day, so it belongs on the place, not the day. Show the base name, night count, the date span, and the climate range from `LOC[base].cl`.
  **The date span is not decoration** — several days share one base, so an outfit edited from day 5 is the same record as days 6 and 7. Without the span this reads as a bug.
- [ ] **Step 5: Day card.** Ported from `index.html:1037-1068`: date, title, place, drive time, progress bar, sunrise/sunset tags, schedule items, day photos, note.
- [ ] **Step 6: Schedule item.** Checkbox ≥44px — verify it actually enlarges; `min-width`/`min-height` on a bare `input[type=checkbox]` may need an `appearance` reset (carried finding from Plan 1 Task 8). Time is tappable to adjust, per `editTime` at `index.html:1418`.
- [ ] **Step 7:** No full re-render. Keyed lists, per-item state. Ticking an item must not rebuild the list — this is the single biggest "feels like a web page" defect in the live app.
- [ ] **Step 8:** Commit.

---

### Task 7: Itinerary — Bookings segment

A `Days | Bookings` segmented control at the top of the Itinerary tab. Read-only list plus edit in this task; the **model rework (date ranges, calendar, attachments) is Plan 3**.

**Files:** Create `app/src/components/BookingList.tsx`, `app/src/components/BookingSheet.tsx`, `app/src/components/Sheet.tsx`

- [ ] **Step 1:** `Sheet` — a real bottom sheet: drag-to-dismiss with momentum, backdrop tap, Escape, focus trap. Reused by every sheet in the app.
- [ ] **Step 2:** Booking list grouped by date, port the card from `index.html:1585-1600`, Maps deep link preserved.
- [ ] **Step 3:** Booking sheet ported from `index.html:1535-1560`, unchanged model for now.
- [ ] **Step 4:** The unbooked-nights warning from `index.html:1573-1577`. **Note in the code that it currently over-reports** — a multi-night stay logged on one date makes the other nights look unbooked. Plan 3 fixes the cause; do not paper over it here.
- [ ] **Step 5:** `S.docs` (Receipts & tickets) still renders — removing it would break the data contract.
- [ ] **Step 6:** Commit.

---

### Task 8: Lists

**Files:** Create `app/src/routes/Lists.tsx`

- [ ] **Step 1:** `To do | Packing` segmented control, ported from `vPack` at `index.html:1625-1665`.
- [ ] **Step 2:** Grouped accordions with per-group counts; overdue todos flagged against `todayISO()`.
- [ ] **Step 3:** Checkboxes ≥44px, same component as the itinerary.
- [ ] **Step 4:** Commit.

---

### Task 9: Budget

**The highest-logic screen and the one most likely to break silently.** It gets a full redesign over ported maths.

**Files:** Create `app/src/routes/Budget.tsx`, `app/src/components/CardSheet.tsx`, `app/src/components/SpendSheet.tsx`, `app/src/components/RateStrip.tsx`

- [ ] **Step 1:** Rate strip — live mid-market rates, the date taken, and a `cached` tag when stale. Ported from `index.html:1742-1760`.
- [ ] **Step 2:** Card list — per card the effective rupiah rate (`cardRate`), spend to date, headroom against `limit`, and a warning past 85%. Ported from `vMoney` (`index.html:1737-1866`). Cash entries (`type === 'cash'`) count down instead.
- [ ] **Step 3:** "Cheapest card to spend on" comparison when more than one card exists.
- [ ] **Step 4:** Card and spend sheets, ported from `index.html:1867-1951`. **Only last-4 is ever stored** — no full numbers, no CVV. Keep that guarantee and the copy that states it.
- [ ] **Step 5:** Tests over the screen's derived numbers — total spend per card, headroom percentage, cheapest-card selection. Use fabricated cards.
- [ ] **Step 6: Manual gate.** Before this task is marked complete, compare side by side against the live app with the same cards and spends entered in both, and record the numbers in the report. This is the one screen where "looks right" is not enough.
- [ ] **Step 7:** Commit.

---

### Task 10: Settings sheet

Everything from the old Export tab, behind the header gear.

**Files:** Create `app/src/components/SettingsSheet.tsx`

- [ ] **Step 1:** Sync setup form ported from `syncSheet` (`index.html:1340-1381`) — owner, repo, branch, device, token. **Keep the warning that the data repo must be private.** While `VITE_SYNC_ENABLED` is off, show the form but disable Connect with an explanation.
- [ ] **Step 2:** Download backup — JSON of bookings, ticks, notes. Port from `vOut` (`index.html:1952-2058`).
- [ ] **Step 3:** Storage usage via `navigator.storage.estimate()`, and the persisted-storage request.
- [ ] **Step 4:** App updates — show `BUILD`, offer a hard refresh.
- [ ] **Step 5:** Commit.

---

## Definition of done

- `bun run test` green, `bun run e2e` green, `bunx tsc --noEmit` clean
- `https://nocturnowll.github.io/honeymoon/` still serves `BUILD='2026.08.07-4'`
- `/honeymoon/next/` renders all five tabs with real trip data from localStorage
- The deployed bundle still contains **no** sync wiring (`grep -c visibilitychange dist/assets/*.js` → 0)
- Budget verified side by side against the live app, numbers recorded

## Not in this plan

- The interactive map beyond a placeholder tab — Plan 3
- Bookings date ranges, calendar pickers, attachments — Plan 3
- `vite-plugin-pwa`, the `/legacy/` fallback, and cutover — Plan 3
- Turning sync on — Plan 3, at cutover
