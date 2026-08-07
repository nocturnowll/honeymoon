# Larch & Canyon — SPA rewrite design

**Date:** 2026-08-07
**Status:** approved, pending implementation plan
**Trip:** 14 Sep – 6 Oct 2026

## Why

The app works and is in daily use by two people. This rewrite is not a rescue —
it is a deliberate trade of a 2,100-line single-file vanilla app for a
structured one, plus a full visual redesign, plus three fixes that matter more
than either:

1. Fonts load from Google's CDN and the service worker never caches them, so the
   typography collapses offline — precisely in Yosemite, Death Valley and Bryce.
2. Every interaction rebuilds the whole view's `innerHTML`, then restores scroll
   position and replays a fade. On a 22-day itinerary that reads as a web page,
   not an app.
3. A booking holds one date, so a three-night stay is stored as one night and
   the "unbooked nights" warning tells you to book rooms you have already paid
   for.

## Decisions taken

| Question | Decision |
|---|---|
| Architecture | Full Vite SPA rewrite |
| Changeover | Replace in place, coordinated update on both phones |
| Redesign scope | All screens |
| Freeze date | None — ship when ready |
| Itinerary layout | Date rail + sticky day headers |
| Map | Offline vector trip map, no tiles |
| Bookings | Date ranges, calendar pickers, PDF/image attachments |

The user was advised that replace-in-place, full redesign and no freeze date
each carry more risk than the alternative offered, chose them anyway, and that
is recorded here as an accepted trade rather than an oversight.

## Stack

| Concern | Choice | Rationale |
|---|---|---|
| Build | Vite 7, **Bun** | Bun is the standing rule in all repos here |
| UI | React 19 + TypeScript | React matches the rest of the estate; TS because the data shape *is* the risk |
| Service worker | `vite-plugin-pwa` (Workbox) | generated precache manifest removes the "forgot to bump `V`" failure mode |
| Routing | hash routes (`#/itinerary`, `#/day/8`) | Pages serves from a subpath and the app runs standalone; hash routes cannot 404 on refresh |
| State | one typed store + `useSyncExternalStore` | no Redux; keeps the single `S` object, which is what preserves compatibility |
| Styling | plain CSS + existing custom properties | the bespoke palette and type pairing are good and already the product's identity |

### Structure

```
src/
  routes/      now · itinerary · budget · lists · map
  components/  DayCard, DateRail, PlaceHeader, ScheduleItem, Sheet, SyncChip, TripMap
  state/
    schema.ts    TripState types — the compatibility contract, in one file
    store.ts     the S object, typed
    persist.ts   localStorage + IndexedDB
    sync/        github.ts · merge.ts · photos.ts
  data/
    itinerary.ts DAYS + LOC, lifted out of index.html
  lib/           fx.ts · dates.ts · image.ts · geo.ts
public/
  assets/fonts/*.woff2   self-hosted, precached
  assets/geo/*.json      Natural Earth geometry
```

### Deploy change

A Vite build emits `dist/`, so Pages must move from "deploy from a branch" to a
**GitHub Actions workflow**. This is also an improvement in its own right: on
2026-08-07 a legacy branch build sat wedged in `building` for over a day,
blocked the queue, failed two subsequent runs, and reported only
`"Page build failed."` with no detail. Actions gives logs and a re-run button.

## The data-compatibility contract

The rewrite reads and writes these **byte-identically** to the current app.
This is the section that carries real risk; everything else is recoverable.

### On each device

| Where | Key | Contents |
|---|---|---|
| localStorage | `larchcanyon` | the whole `S` object |
| localStorage | `larchcanyon.gh` | `{owner, repo, branch, token, device}` — the PAT |
| localStorage | `larchcanyon.fx` | `{rates, at}` |
| IndexedDB | db `larchcanyon` v1, store `blobs` | photo/document Blobs keyed by id |

### In `honeymoon-data` (private)

- `data/state.json` — same shape, same `_t` per-field timestamp map, same
  `_updated` / `_by`
- `data/photos/{id}.jpg` — same paths, same `{p, f}` reference objects

### The `S` shape

Frozen as TypeScript in `state/schema.ts`: `done`, `items`, `bookings[]`,
`photos`, `outfits`, `docs[]`, `todos`, `packing`, `spend[]`, `notes`,
`cards[]`, `_t`, `_updated`, `_by`, `v`.

Arrays keyed by `.id` remain exactly `bookings` / `docs` / `spend` / `cards` —
this is the `BY_ID` list the merge depends on.

### Commitments

- **No migration step.** The SPA opens the existing localStorage and IndexedDB
  and works. If the rewrite is abandoned, the old build reads the same data.
- **`merge.ts` is ported line-for-line, not rewritten.** Tombstones, per-field
  timestamps and deletions surviving a round trip are subtle and currently
  correct. It gains types and tests, not improvements.
- **Tests use a production-*shaped* fixture, never the real snapshot.**
  `nocturnowll/honeymoon` is **public** — that is the whole reason trip data
  lives in the separate private repo — so the committed fixture mirrors the real
  file's structure and edge cases (`_t` stamps, `{f: …}` photo refs, the
  `done:0.7` tombstone, id-keyed arrays) with fabricated content. A real
  snapshot may be dropped in locally as `state.real.json`, which is gitignored.

### Additive fields

`booking.end` and booking attachments are **additive**. An older build ignores
them and keeps working from `date`. The sync photo-walker gains one more place
to look. Nothing breaks if one phone lags behind.

### What does change

The hand-written `sw.js` becomes a Workbox-generated worker. Cache names change,
so both phones re-download the shell once at cutover — do it on wifi. Data lives
in localStorage and IndexedDB, which the cache change does not touch.

## Navigation

Seven tabs in a horizontally-scrolling bottom bar is itself a native-feel
problem; iOS tab bars stop at five. "Export" is settings, not a destination.

```
BOTTOM NAV (5)        HEADER
  Now                   [sync chip]  [gear]
  Itinerary                           └─ backup, sync setup, app updates
  Budget
  Lists
  Map
```

- **Scrapbook is dissolved.** Day photos (`S.photos`) already render inside day
  cards. Outfits (`S.outfits`) are keyed by *base location*, not day, so they
  attach to a new place header in the itinerary.
- **Bookings** becomes a `Days | Bookings` segmented control at the top of
  Itinerary. Day cards keep their booking banners; Now keeps showing today's.
- **Lists** keeps its existing To do / Packing segmented control.
- **`S.docs`** (Receipts & tickets) stays in the schema — removing it would
  break the contract — and surfaces under the Bookings segment. Most new
  documents will arrive as booking attachments instead, but existing entries
  must keep rendering and syncing.

## Now

The daily driver, and the screen most used during the trip itself. It answers
one question — what is happening now and next — and nothing else:

- current schedule item, prominent; next item beneath it
- today's bookings, with the check-in-versus-arrival warning that already exists
- weather for today, live from ~30 Aug and seasonal averages before that
- countdown before departure; day *n* of 22 during the trip

`tripPhase()` already distinguishes before / during / after and the current
build re-renders this view on a 60-second timer while travelling. Both
behaviours carry over.

## Itinerary

Leg → place → days, with a tappable date rail:

```
┌──────────────────────────┐
│ [ Days ] [ Bookings ]    │
│ CANADA · 6 days          │  sticky
│ 14 15 16 17 [18] 19 20 → │  tap to jump
├──────────────────────────┤
│ ┌ Canmore · 3 nights     │  place header
│ │  [outfit] pieces·notes │  Hershania's, once per place
│ │  18 SEP  Lake Louise   │  sticky while its day scrolls
│ │  08:00 ○ Depart        │
│ │  11:30 ● Moraine Lake  │
│ └ Calgary · 1 night      │
└──────────────────────────┘
```

Multiple days share one base, so an outfit edited from day 5 is the same record
as days 6 and 7. The place header must show its date span so this reads as
intent, not a bug.

## Map

Its own tab. The per-leg PNG slot inside Itinerary becomes the same component
scoped to that leg, tappable to open full — one component, two sizes.

- Public-domain Natural Earth geometry: coastline, state/province borders,
  major roads
- The 12 `LOC` pins, which already carry `lat`/`lon`
- Route line between consecutive bases
- Pinch-zoom, pan, tap a pin → that day
- ~200KB total, fully offline, replacing 608KB of static PNGs

Explicitly **not** a slippy tile map. Offline OSM tiles for this region run
150–250MB and duplicate what Google Maps offline regions already do better,
including turn-by-turn. The app owns "show me my trip as a shape"; the native
map app owns navigation, reached through the existing deep links.

## Bookings rework

| | now | after |
|---|---|---|
| Dates | single `date`, dropdown of the 22 trip days | `date` + optional `end`, real `<input type="date">` |
| A stay | appears on one day | spans every night, banner on each |
| Unbooked check | exact per-date match, so multi-night stays false-alarm | counts nights actually covered |
| Times | manual `type="time"` | kept, optional and secondary |
| Attachment | images only, in a separate Documents section | PDF **or** image, attached to the booking |

PDFs store as Blobs in the same IndexedDB store and sync to the data repo like
photos. iOS renders them natively from an object URL — no PDF.js, no bundle
cost. The existing hint that *"PDFs are far too large for browser storage"* is
stale; it was true when everything was base64 in localStorage's 5MB, and photos
moved to IndexedDB.

**Out of scope:** auto-parsing a Booking.com email into fields. That needs OCR
or an LLM, neither works offline, and the format changes without warning.

## Native-feel baseline

Applies to every screen:

- Self-hosted Bricolage Grotesque / Inter / JetBrains Mono, latin subset, woff2,
  preloaded and precached
- 44px minimum tap targets — the current 21px checkbox is the most-used control
  in the app
- No full re-renders: keyed lists, no `innerHTML`, no scroll-restore hack, no
  fade replay on every tick
- `overscroll-behavior: none`; `user-select: none` on chrome only; pinned
  `text-size-adjust`; all inputs ≥16px so iOS stops zooming on focus
- Sheets become real bottom sheets with drag-to-dismiss and momentum
- `prefers-reduced-motion` already respected — keep it

## Error handling

- Per-route error boundaries, so one broken screen cannot white-screen the app
  in a canyon
- Sync failures stay in the header chip, distinguished properly: `offline` vs
  `token expired` vs `both phones syncing`
- Failed photo uploads keep retrying on the next sync, as today
- Local write failure shows `not saved` in the header (shipped 2026-08-07)

## Testing

Concentrated where the risk is, not spread evenly.

| Target | Why |
|---|---|
| `merge.ts` | the subtle one; fixture is the real `data/state.json` including tombstones, asserting round-trip equality |
| `fx.ts` | rate conversion and per-card markup — the logic most likely to break silently in a redesign |
| `dates.ts` | `tripPhase`, `currentDayIdx`, `daysBetween` are timezone-sensitive and day one crosses the date line |
| Playwright smoke | on the built output: load → tick an item → reload → still ticked |

Manual gate before cutover: Budget tab compared side by side against the old
build. It carries the most logic and gets a full redesign, which is the riskiest
combination in this project.

## Cutover

**Flip `VITE_SYNC_ENABLED=1` first.** The SPA is built with sync gated OFF by a
build-time flag, and this is not optional bookkeeping — localStorage is scoped
per **origin**, not per path. `/honeymoon/next/` is the same origin as
`/honeymoon/`, so the in-progress build can read the real PAT and the real photo
blobs the live app wrote. Without the gate, either phone opening the development
URL once would run a real two-way sync against the private data repo and point
`sweepOrphans` at real photos — from a build with no user interface. The flag is
read in `app/src/state/store.ts`; when unset, Vite constant-folds the branch and
the lifecycle wiring is eliminated from the bundle entirely.

1. A frozen copy of the current app stays deployed at `/legacy/` — an instant
   fallback URL needing no deploy to reach
2. Both phones on wifi, force-quit, reopen
3. Verify: sync chip green, 16 photos present, both notes intact, then edit on
   one phone and watch it land on the other
4. Rollback: `git revert` and push, or open `/legacy/`

## Open risks

- **No freeze date.** The deadline is a flight and does not move. Ship order
  should keep the app usable at every point rather than assuming a big-bang
  finish.
- **Replace-in-place.** A bad deploy lands on the tool both people are actively
  using. `/legacy/` is the mitigation.
- **Budget redesign.** Most logic, full visual rework, hardest to eyeball for
  correctness. Hence the manual side-by-side gate.
