# TASK — Larch & Canyon

**For:** `Buffy-larch-canyon` (GPT 5.6)
**From:** `CC-larch-canyon` (Opus) — writes the plans, reviews, and pushes.
**Updated:** 2026-08-08

---

## Standing rules for this repo

1. **Do not push.** Commit locally, post a Live Log line, and stop. CC reviews, then pushes.
2. **Never touch the repo-root `index.html`, `sw.js`, `manifest.json`, `assets/`, or `legacy/`.** The root is the LIVE app both phones use; `legacy/` is a frozen snapshot of it that exists as the cutover rollback path. All work is under `app/`.
3. **This repo is PUBLIC.** No real trip data, tokens, addresses, confirmation numbers or card details in source, tests or fixtures. Fixtures are production-*shaped* with fabricated content.
4. **`VITE_SYNC_ENABLED` stays OFF.** It flips only at Plan 3 Task 8. Verify after every build: `grep -c visibilitychange dist/assets/*.js` → `0`.
5. **Port, don't improve.** Where a task says port from `index.html:NNNN`, transcribe and add types. If something looks wrong, write it in your report and leave it. (Line references in the plan docs were all corrected on 2026-08-08 and are now trustworthy.)
6. Bun only. Never npm/yarn/pnpm.

---

## Done and merged since your last check

Everything previously in this queue has landed. For context, not action:

| Work | Commit |
|---|---|
| Image resize, outfit thumbnails, 44px tap target | `b6e3230` |
| SPA legacy photo-ref migration | `ee44407` |
| Sheet portal (fixes the date rail painting over sheets) | `7d2ed1e` |
| Trip geometry + Mercator projection | `a627b45` |
| Booking date ranges + real date pickers | `3f94aa8` |
| Budget parity fixes (3 divergences) | `9112035` |
| `migrateFileRefs(remote)` no longer stamps `_t` | `f203006` |
| `/legacy/` rollback path | `02277fb` |

Suite is at **89 tests**. Two more are in review: the map component (Task 2) and booking attachments (Task 5).

Three of these had defects caught in review that are worth knowing about, because they are the house style of bug here:
- `nightsCovered` looped on a lexicographic ISO comparison, so a malformed `end` merged in from the other phone never terminated and froze the app during render.
- `migrateFileRefs(remote)` stamped `_t` with `Date.now()`, making the remote win every merge and silently dropping unsynced local photo edits.
- The map's pan was unclamped, so one swipe could push the geometry off-screen with no way back.

All three are the same shape: **data arrives from another device and nothing validates it.**

---

## Your task: Plan 3 Task 6 — service worker via `vite-plugin-pwa`

`docs/superpowers/plans/2026-08-07-larch-canyon-map-bookings-cutover.md`, **Task 6 only**.

Read the whole task before starting. **Step 6 is the one that matters** and it is counter-intuitive:

A service worker's scope is a **prefix**. The SPA's worker at `/honeymoon/` will also control `/honeymoon/legacy/`. If you enable Workbox's `navigateFallback`, a navigation to `/honeymoon/legacy/` gets answered with the SPA's own `index.html` — which makes the legacy app unreachable **through the exact mechanism the cutover rollback depends on**, and it keeps happening after a `git revert` until the worker updates.

This app is hash-routed (`lib/router.ts` reads `location.hash`), so a navigation fallback buys nothing. Do not enable one. If you believe you must, it needs `navigateFallbackDenylist: [/^\/honeymoon\/legacy\//]`.

Also required by that task:
- Precache the three self-hosted woff2 fonts — verify they appear in the generated manifest, or the offline typography bug returns.
- Never runtime-cache `api.github.com`, `open-meteo`, or `er-api.com`.
- Confirm the idb-harness is absent from the precache manifest.
- Step 7 is a proof step: load `/honeymoon/legacy/` with the new worker installed and confirm the **old** app renders, not the SPA. Report what you saw.

**Do not start Task 8 (cutover).** That is Kenny's, needs both phones together on wifi, and flips the sync gate.

---

## Reporting

One terse Live Log line per milestone; detail here or in your report file. Include real command output for tsc, unit tests, build and the `visibilitychange` gate — not a summary of them.
