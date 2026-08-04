# Larch & Canyon

Interactive honeymoon itinerary — Kenny & Hershania, USA & Canada, 14 Sep – 6 Oct 2026.

Single-page app, no build step, no backend. Works offline once loaded.

## Deploy

See SETUP.md in the parent folder for full instructions.

## Quick version

1. Create a new repository on GitHub. Public is fine; **Pages does not work on private repos on the free plan.**
2. Upload every file in this folder to the repository root:
   `index.html`, `manifest.json`, `sw.js`, `icon.png`, and the five `map_*.png` files.
   Keep them flat — no subfolder, or the map images and offline cache break.
3. Repository → **Settings** → **Pages**.
4. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**. Save.
5. Wait 1–2 minutes. Your URL is `https://<your-username>.github.io/<repo-name>/`

### Install it on your phone
Open the URL in Safari or Chrome → Share → **Add to Home Screen**. It then launches
full-screen like an app and works without signal.

**Do this before you fly.** The service worker only caches files after a first visit
over HTTPS, so open the site once on each phone while you still have wifi.

## Where your data lives

Local-first: every edit saves to the device immediately, so the app works with
no signal. If GitHub sync is connected, edits are merged into a private data
repo and shared with the other phone. Without sync it is device-only.

**Export → Download backup** writes a JSON file with everything in it. Do that
regularly, and after any large edit. That file is also how you move your data to
another device: open the app there and use **Restore from file**.

Suggestion: one of you owns the bookings and receipts, the other owns the scrapbook.
Trying to keep both phones identical will not work.

## What needs a network

Only the live weather (Open-Meteo) and the web fonts. Everything else runs offline.
Weather shows live forecasts when a date falls inside the 16-day window, and seasonal
ranges marked `≈` otherwise — so it will look mostly seasonal until around 30 August.

## Editing the itinerary itself

The 22 days are a plain JavaScript array called `DAYS` near the top of `index.html`.
Each schedule row is `['time', 'title', 'note', 'flag']` where flag `k` marks a key
moment. Times you change inside the app are stored separately and marked with `*`,
so the built-in plan is never lost.
