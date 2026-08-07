# TASK — Larch & Canyon

**For:** `Buffy-larch-canyon` (GPT 5.6)
**From:** `CC-larch-canyon` (Opus) — writes the plans, reviews, and pushes.
**Updated:** 2026-08-08

---

## Standing rules for this repo

1. **Do not push.** Commit locally, post a Live Log line, and stop. CC reviews, then pushes. This is the bus's standing third-party rule and it earned its keep on `dc5b41c` — the outfit work was correct but shipped without an image resize, which only surfaced in review.
2. **Never touch the repo-root `index.html`, `sw.js`, `manifest.json`, `assets/`.** That is the LIVE app both phones use. All work is under `app/`.
3. **This repo is PUBLIC.** No real trip data, tokens, addresses, confirmation numbers or card details in source, tests or fixtures. Fixtures are production-*shaped* with fabricated content.
4. **`VITE_SYNC_ENABLED` stays OFF.** It flips only at Plan 3 Task 8. Verify after every build: `grep -c visibilitychange dist/assets/*.js` → `0`.
5. **Port, don't improve.** Where a task says port from `index.html:NNNN`, transcribe and add types. If something looks wrong, write it in your report and leave it.
6. Bun only. Never npm/yarn/pnpm.

---

## Queue — work top to bottom

### 1. Image resize pipeline · **do this first**

**Why it's first:** `OutfitSheet` puts the raw `File` into IndexedDB. There is no resize anywhere in `app/src`. A current iPhone photo is 4032px / 3–6MB, so 12 destinations × 2 looks is ~100MB on the device instead of ~10MB. Invisible while sync is off; at cutover every one of those uploads as base64 into the data repo, over hotel wifi, permanently. The cost grows with every photo added before it lands.

- Create `app/src/lib/image.ts`. Port `processImage` from **`index.html:864-885`** — canvas resize to **1800px** on the long edge, re-encode JPEG at **0.82**, `imageSmoothingQuality: 'high'`. Keep the rejection of non-images and the error messages.
- Wire it into `OutfitSheet` so `store.addLocalPhoto` receives the processed Blob, never the raw `File`.
- Make it the single entry point for **every** future photo input — day photos, documents, booking attachments in Plan 3.
- Tests: a wide image scales to 1800 on its long edge; a small image is not upscaled; a non-image rejects; output MIME is `image/jpeg`. Use a canvas-generated Blob, not a fixture file.

**Acceptance:** a 4000×3000 input yields ≤1800px and a materially smaller Blob, proven by assertion, not by eye.

### 2. Legacy photo refs — the SPA cannot see them either · **new, added 2026-08-08, blocks cutover**

Diagnosed by CC on 2026-08-08 against the real sync repo. Do not re-investigate; implement.

An early build of the live app (`d0f4ab0`) uploaded photos as files named `${section}_${key}.jpg` and wrote the reference as `{f: path}` with **no `p`**. `d1f5e58` replaced that with the IndexedDB blob scheme 99 minutes later and moved every read path onto `ref.p`, but nobody wrote a migration. All 16 of Kenny's real photos were uploaded inside that window, so every one of them is currently unreadable — the `.jpg` files are intact in the sync repo, but no version since can resolve them.

The SPA inherits this exactly:

- `state/sync/photos.ts:7` — `isRef` requires `typeof v.p === 'string'`, so a `{f}`-only ref is not collected at all
- `state/store.ts:135` — `photoUrl` does `this.photoUrls.get(ref.p)`
- `state/schema.ts:3` — `PhotoRef` declares `p` as required

Flip the sync gate at cutover without this and the photos stay blank on both phones.

**The repair is exact:** the old filename IS the id the current scheme would have used, so `p` is the basename of `f` minus `.jpg` — `data/photos/photos_1.0.jpg` → `photos_1.0`. CC verified all 16 derive cleanly and all 16 files exist.

- Add a migration that runs when state is loaded, before anything reads a ref. Walk all four ref homes (`photos`, `outfits.img`/`img2`, `docs.img`, `bookings.files`) — note the SPA has a fourth home the live app does not.
- Repair only when the value is a non-null object with a string `f` ending `.jpg` and no truthy `p`. Set `p` in place; keep `f`. Skip if the derived id is empty.
- Stamp the field's `_t` so the corrected shape wins the merge, the same way an edit would.
- Must be idempotent: a second run repairs zero.
- Tests: each ref home; an already-correct ref untouched; a non-`.jpg` `f` untouched; `null`/`undefined` no crash; second run repairs 0; the exact `_t` keys stamped.

CC is landing the equivalent migration in the live `index.html` today. **Match its derivation exactly** — read that commit before you start; if the two disagree, the photos break on whichever app runs second. Ask on the bus rather than guessing.

### 3. Show the outfit photo on the card

`OutfitCard` currently says "1 outfit photo saved" and hides the photo behind the sheet. This is the wife-facing feature and it is a visual one — she should see the look on the itinerary without tapping.

- Render a thumbnail (or two) on the card using `store.photoUrl(ref)`.
- Keep `usePhotoRevision()` so it repaints when blobs change.

### 4. `.outfit-remove` opts out of the 44px tap target

`app/src/styles/base.css` sets `min-width:0;min-height:0` on it. It is a destructive control below the platform minimum. Give it a real hit area without making it visually heavy — padding, not a button block.

### 5. Budget side-by-side gate — **outstanding from Plan 2 Task 9 Step 6**

Your own log says the UI gate "remains unperformed". Budget carries the most logic and got a full redesign, which is the riskiest combination in this project.

- Build a short reproducible checklist: enter the same 2 cards (one with markup, one cash) and 3 spends in **both** the live app and `/next/`, then compare: effective IDR rate per card, spend total per card, headroom %, the 85% warning, and which card is named cheapest.
- Record the actual numbers from both, side by side, in your report. Do not mark it done on formula inspection — that was already done and is not the gate.

### 6. Then Plan 3, Tasks 1–2 (map geometry + component)

`docs/superpowers/plans/2026-08-07-larch-canyon-map-bookings-cutover.md`. Do **not** start Task 8 (cutover) — that is Kenny's call, needs both phones together on wifi, and flips the sync gate.

---

## Known issue, not yours to fix — just don't be surprised by it

`/honeymoon/` and `/honeymoon/next/` are the **same origin**, so they share `localStorage` AND IndexedDB. An outfit saved in `/next/` genuinely appears in the legacy Scrapbook — same records, by design. But with **both open at once**, each holds a whole-state snapshot and writes the whole key, so the last save wins and the other's edits vanish. Test with one build open at a time.

---

## Reporting

Per the bus's token discipline: one terse Live Log line per milestone, detail here or in your report file. Include real command output for tsc, unit tests, build and e2e — not a summary of them.
