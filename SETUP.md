# Setup — about 10 minutes

## Why two repositories

GitHub Pages needs a **public** repo on the free plan. Your itinerary will hold
hotel addresses, confirmation numbers, receipts and Hershania's outfit photos.
Those must not be public. So:

| Repo | Visibility | Holds |
|---|---|---|
| `honeymoon` | **public** | the app — served by Pages |
| `honeymoon-data` | **private** | your data — reached only through the API |

Pages never touches the data repo, so it can stay private at no cost.

---

> **Hosting on Vercel instead?** Skip to *Deploying on Vercel* at the end. The
> app is plain static files, so both hosts work identically. Vercel does **not**
> change where your data lives.

## 1 · The app repo (public)

1. New repository → name it `honeymoon` → **Public** → Create.
2. Upload everything from the `app/` folder, **keeping the folder structure**:

       index.html
       manifest.json
       sw.js
       README.md
       assets/icon.png
       assets/maps/overview.png
       assets/maps/canada.png
       assets/maps/sierra.png
       assets/maps/utah.png
       assets/maps/la.png

   Drag the whole `assets` folder in — GitHub keeps subfolders. If the maps end
   up in the root instead, the images break.
3. Settings → Pages → Source **Deploy from a branch**, Branch **main**, Folder **/ (root)**. Save.
4. Wait 1–2 minutes. Your URL: `https://<username>.github.io/honeymoon/`

## 2 · The data repo (private)

1. New repository → name it `honeymoon-data` → **Private** → Create.
2. Upload the contents of the `data-repo-template/` folder, keeping structure:

       data/state.json
       data/photos/.gitkeep
       README.md

3. Do **not** enable Pages on this one.

## 3 · The access token

1. GitHub → your avatar → **Settings** → **Developer settings**
   → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Set it up as:
   - **Name:** `larch-canyon`
   - **Expiration:** a custom date **after 6 October 2026** (say 31 October 2026)
   - **Repository access:** *Only select repositories* → **`honeymoon-data`** only
   - **Permissions** → Repository permissions → **Contents: Read and write**
     (leave everything else alone)
3. Generate, and copy the token. **GitHub shows it once.**

> Only tick Contents, and only point it at the data repo. A token this narrow
> can do nothing except read and write your own trip files.

## 4 · Connect each phone

On the phone, open your Pages URL → **Export** tab → **Set up GitHub sync**:

- Username: your GitHub username
- Data repository: `honeymoon-data`
- This device: `Kenny iPhone` / `Hershania iPhone`
- Token: paste it

Tap **Connect and sync**. Repeat on the second phone with the same details and
a different device name.

The token is stored on that phone only. It is never written into either repository.

## 5 · Add to Home Screen

Safari or Chrome → Share → **Add to Home Screen**. It then opens full-screen and
works without signal.

**Do this before you fly**, on both phones, while you still have wifi — the app
only caches itself after a first visit over HTTPS.

---

## How syncing behaves

- Every edit saves to the phone **first**, so nothing depends on having signal.
- Sync runs on open, every 5 minutes, when you regain connection, and when you
  tap the chip in the header.
- Merging is per field. Kenny editing bookings while Hershania edits the
  scrapbook — both survive. The same field edited on both phones within one
  sync window — the newer edit wins.
- Deletions propagate properly, so removing a booking on one phone removes it
  on the other.
- Photos upload as individual `.jpg` files, so `state.json` stays small and the
  repo history stays manageable.

## The header chip

| Chip | Meaning |
|---|---|
| `local only` | sync not set up — data is on this device alone |
| `sync ready` / `synced 14:32` | connected and up to date |
| `syncing…` | in progress |
| `offline` | no connection; edits are saved locally and go up when you reconnect |
| `sync failed` | usually an expired token — open Export → Settings |

## If the token expires mid-trip

The chip turns red and edits keep saving locally. Generate a new token and paste
it into Export → Settings. Nothing is lost.

## Updating the app after the first deploy

The header shows nothing about versions, but **Export → App updates** shows the
build number. Compare it to the `BUILD` constant near the top of `index.html`.

1. Upload the new files, replacing the old ones. `sw.js` matters as much as
   `index.html` — its version string is what retires the old cache.
2. Close the app fully on each phone and reopen it. It fetches the new shell,
   shows "New version ready — reopening", and reloads itself.
3. If a phone is still showing the old screen, open **Export → App updates →
   Fetch the latest version**. That clears the cached copy and the worker, then
   reloads.

On an installed Home Screen app, force-quit it from the app switcher first —
otherwise iOS may keep the old page alive in the background.

## Storage

Photos are held as binary in **IndexedDB**, not in localStorage. That matters:
localStorage caps at roughly 5 MB per site and only stores text, so images had
to be base64 — a third larger than the file itself. IndexedDB stores real files
and its quota runs from hundreds of megabytes to several gigabytes depending on
the device, so the practical ceiling is your phone's free space.

Photos are resized to 1800px and re-encoded at good quality, landing around
300–500 KB each. A few hundred is not a problem.

The app also asks the browser for *persistent* storage on first run, which stops
the OS reclaiming your photos when space runs low. Safari may show a prompt;
allow it.

If a photo is already synced it also exists in the data repo, so even a wiped
phone gets everything back by reconnecting.

## Still export a backup file

Export → **Download backup** writes a JSON file with your bookings, ticks and
notes. Photos are not inside it — they live in the data repo and return on their
own once sync is connected. Do it before you fly.


---

## Deploying on Vercel instead

Both work. Some honest differences.

**Vercel does not solve storage.** Storage was a localStorage problem and it is
already fixed — photos are Blobs in IndexedDB, capped only by your phone's free
space. Hosting has nothing to do with it; the same app on Vercel behaves
identically.

**What Vercel actually gives you**

- The app repo can be **private**. GitHub Pages needs a paid plan for that;
  Vercel Hobby deploys private repos for free. (The deployed site is still public
  either way — only the source is hidden.)
- Faster global CDN and instant rollbacks.
- Custom domains with less fuss.
- Serverless functions, if you ever want a real backend.

**What it does not change**

- Data still lives in IndexedDB on each device, synced through the private data
  repo. Vercel is serving files, nothing more.
- You still need the `honeymoon-data` repo and the token.

### Steps

1. Push the contents of `app/` to a GitHub repo — public or private, your choice.
2. On Vercel: **Add New → Project → Import** that repo.
3. Framework preset: **Other**. Build command: **leave empty**. Output directory:
   **leave empty** (or `.` if it insists). There is no build step.
4. If you committed the `app/` folder rather than its contents, set
   **Root Directory** to `app`.
5. Deploy. You get `https://<project>.vercel.app`.

`vercel.json` is included and sets the caching headers correctly — long cache on
the maps and icon, no cache on `index.html` and `sw.js` so updates land
immediately rather than being served stale from the service worker.

Vercel's Hobby plan is for non-commercial use, which a personal trip is.

### Worth knowing for later

If you ever want the GitHub token off the devices entirely, a Vercel serverless
function could hold it and proxy the writes. That is the one real architectural
upgrade Vercel offers here. It is not necessary — a fine-grained token limited to
one private repo with Contents-only permission can do nothing else — but the
option exists.

---

## Money and exchange rates

The **Budget** tab pulls live mid-market rates from ExchangeRate-API, no key
required, and caches them so conversions still work with no signal. The date of
the rate is shown, and a `cached` tag appears when it is not fresh.

**Cards.** Add each card with its bank, the name on it, the last four digits, the
credit limit and — the important one — its **FX markup**. Banks settle card
transactions at roughly the Visa or Mastercard rate plus their own margin, and no
public API exposes those per-bank rates, so the app uses the live mid-market rate
plus the markup you enter. Indonesian issuers are commonly 2–3.5%; check your
cardholder terms and enter the real figure.

Each card then shows its effective rupiah rate, what it has cost you, and how
much headroom is left against the limit, with a warning past 85%. With more than
one card, the app tells you which is cheapest to spend on.

**Cash** is tracked as its own entry per currency — enter what you are carrying
in USD and CAD and it counts down as you log spending.

Only the last four digits are ever stored. No full card numbers, no CVV, nothing
that could be used to transact.

**One rule worth more than any of this:** when a terminal or website offers to
charge you in rupiah instead of dollars, decline. That is dynamic currency
conversion and it typically costs 3–7% on top of what your bank already charges.
Always choose USD in the States and CAD in Canada.
