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

### 1. Image resize pipeline · ✅ **done in `b6e3230`, reviewed + pushed 2026-08-08**

Reviewed clean — the port is faithful and the null-context guard you added is a genuine improvement over the original. Note my line reference below was wrong: `processImage` is at **`index.html:903-920`**, not 864-885. You transcribed it correctly anyway.

Three Minor findings from that review, all small — fold them into your next commit:

- **`OutfitSheet` swallows `processImage`'s error message.** The catch sets `'That photo could not be saved. Try a smaller image.'` for every failure, but `processImage` rejects with specific, user-facing text — pick a PDF and you get told to try a smaller image, which is wrong advice. The legacy app surfaces `err.message` directly (`index.html:928`). Do the same: use the thrown message when there is one, keep your generic string as the fallback for everything else.
- **`PhotoThumbnail` names a prop `ref`.** It works under React 19's ref-as-prop, but it is a landmine for anyone who later wraps the component. Rename to `photo`.
- **`photoUrl` is called twice per thumbnail** — once building `thumbnails`, once inside `PhotoThumbnail`. Pass the resolved `src` down instead of re-resolving.

Original brief, kept for reference:

> **Why it's first:** `OutfitSheet` puts the raw `File` into IndexedDB. There is no resize anywhere in `app/src`. A current iPhone photo is 4032px / 3–6MB, so 12 destinations × 2 looks is ~100MB on the device instead of ~10MB. Invisible while sync is off; at cutover every one of those uploads as base64 into the data repo, over hotel wifi, permanently. The cost grows with every photo added before it lands.

> - Create `app/src/lib/image.ts`. Port `processImage` (canvas resize to **1800px** long edge, JPEG **0.82**, `imageSmoothingQuality: 'high'`), keeping the non-image rejection and the error messages.
> - Wire it into `OutfitSheet` so `store.addLocalPhoto` receives the processed Blob, never the raw `File`.
> - Make it the single entry point for **every** future photo input — day photos, documents, booking attachments in Plan 3.

My stated acceptance ("a materially smaller Blob, proven by assertion") was not achievable: jsdom has no canvas, so `toBlob` must be mocked and the output size is whatever the mock returns. The dimension and quality assertions are the real proof, and they are there. My criterion was wrong, not your tests.

### 2. Legacy photo refs — the SPA cannot see them either · ✅ **done in `ee44407`, reviewed — one follow-up as item 4**

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

The live app's equivalent migration shipped in **`da1cb18`** (`migrateFileRefs`, `index.html`) and is live at BUILD `2026.08.08-1`. **Read it and match the derivation exactly** — if the two disagree, the photos break on whichever app runs second. Ask on the bus rather than guessing.

### 3. Sheets are trapped in a stacking context · ✅ **done in `7d2ed1e`, reviewed clean**

Kenny opened `Plan outfits · SEA` in `/next/` and the **date rail paints straight across the middle of the open sheet**. The header is also undimmed and the bottom nav sits on top of the sheet.

Diagnosed, do not re-investigate. All three symptoms are one cause:

`OutfitCard` — and therefore `<Sheet>` and its `.modal` — renders **inside** `<section className="place-header">` (`components/PlaceHeader.tsx`). `.place-header` is `position:sticky; z-index:10`, and a positioned element with a non-auto `z-index` **creates a stacking context**. So `.modal`'s `z-index:100` is not competing against the page — it is competing *inside* `.place-header`, and the whole sheet composites at **10**. Everything with a higher root-level z-index therefore wins:

| Element | z-index | Result |
|---|---|---|
| `nav` | 50 | paints over the sheet |
| `header` | 40 | never gets dimmed by the scrim |
| `.date-rail` | 20 | paints across the sheet — what Kenny saw |
| `.modal` | 100, but trapped at 10 | loses to all three |

**Fix: render `Sheet` through a portal.** In `components/Sheet.tsx`, wrap the returned tree in `createPortal(..., document.body)` from `react-dom`. That puts every sheet at the top level of the document, where its `z-index:100` means what it says, and it makes the component immune to *any* ancestor stacking context anyone introduces later.

Do NOT fix this by deleting or raising `z-index` on `.place-header`. That whack-a-moles one instance and leaves the trap in place for the next component someone nests.

Right now `OutfitSheet` is the only sheet affected — `BookingSheet`, `CardSheet`, `SpendSheet` and `SettingsSheet` all render at route or app level, outside `.place-header`. The portal fixes the present bug and prevents the future ones.

Notes:
- Keep the existing focus management, `Escape` handler, swipe-to-dismiss and `onMouseDown` scrim-click-to-close exactly as they are — only the mount point changes.
- Watch the `if (!open) return null` early return: it must stay above the portal call so nothing mounts when closed.
- Tests: assert the sheet's DOM node is **not** a descendant of the component's parent element and IS a child of `document.body`; assert scrim-click still closes; assert `Escape` still closes.

**Acceptance:** open the outfit sheet in `/next/` on a narrow viewport with the date rail visible, and confirm the rail is behind the scrim and the header is dimmed. Say in your report which viewport width you checked at.

### 4. `migrateFileRefs(remote)` stamps the remote as freshest · **do this next — it is in the merge path**

From my review of `ee44407`. The migration itself is right — derivation matches the live app's `da1cb18` exactly, it is idempotent, it covers all four ref homes, and the tests are real. One defect.

`store.ts` calls `migrateFileRefs(remote)` on the freshly-fetched remote snapshot. `repair()` stamps `state._t[section:key] = Date.now()`. So every key it repairs on the **remote** copy is marked as having been edited *now*.

The merge tie-break is `a >= b ? local : remote` (`sync/merge.ts:44`). Stamping the remote at `Date.now()` makes `b` larger than any real local timestamp, so **the remote wins that key unconditionally**.

Concrete loss: you replace an outfit photo on your phone and it has not synced yet. Sync runs. The remote's copy of that outfit is still legacy-shaped. The migration stamps it at now, the merge prefers it, your new ref is dropped from state, the blob is orphaned, and `sweepOrphans` reclaims it on the next pass. The photo is gone.

The stamp is correct for the **local** state — that is what propagates the repair to the other phone. It is wrong for the remote, because repairing a ref's *shape* is not an edit and must not win a merge.

- Give `migrateFileRefs` a second parameter, e.g. `migrateFileRefs(state, { stamp = true })`, and call the remote path with `{ stamp: false }`. Repair `p` in place either way; only skip the `_t` write.
- Test it directly: a local state with a newer `_t` for `outfits:sea` and a legacy-shaped remote for the same key must merge to the **local** ref. That test fails today.
- Also assert the remote path still repairs `p` — the point is to skip the stamp, not the repair.

Not urgent in the sense that the live app has already repaired all 16 refs, so the remote is currently clean. It matters because it is latent in the merge path and the window reopens at cutover.

### 5. Show the outfit photo on the card · ✅ **done in `b6e3230`**

Thumbnails render on the card and `usePhotoRevision()` is kept. See the two naming/efficiency notes under item 1.

### 6. `.outfit-remove` tap target · ✅ **done in `b6e3230`**

Now `min-width:44px;min-height:44px` with `padding:8px` and a negative margin so the hit area grows without the control gaining visual weight. Good solution.

### 7. Budget side-by-side gate — **outstanding from Plan 2 Task 9 Step 6**

Your own log says the UI gate "remains unperformed". Budget carries the most logic and got a full redesign, which is the riskiest combination in this project.

- Build a short reproducible checklist: enter the same 2 cards (one with markup, one cash) and 3 spends in **both** the live app and `/next/`, then compare: effective IDR rate per card, spend total per card, headroom %, the 85% warning, and which card is named cheapest.
- Record the actual numbers from both, side by side, in your report. Do not mark it done on formula inspection — that was already done and is not the gate.

### 8. Then Plan 3, Tasks 1–2 (map geometry + component)

`docs/superpowers/plans/2026-08-07-larch-canyon-map-bookings-cutover.md`. Do **not** start Task 8 (cutover) — that is Kenny's call, needs both phones together on wifi, and flips the sync gate.

---

## Known issue, not yours to fix — just don't be surprised by it

`/honeymoon/` and `/honeymoon/next/` are the **same origin**, so they share `localStorage` AND IndexedDB. An outfit saved in `/next/` genuinely appears in the legacy Scrapbook — same records, by design. But with **both open at once**, each holds a whole-state snapshot and writes the whole key, so the last save wins and the other's edits vanish. Test with one build open at a time.

---

## Reporting

Per the bus's token discipline: one terse Live Log line per milestone, detail here or in your report file. Include real command output for tsc, unit tests, build and e2e — not a summary of them.
