import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const e2e = process.env.E2E === '1';

export default defineConfig({
  base: '/honeymoon/next/',
  plugins: [
    react(),
    // The PWA manifest is a hand-written static file at public/manifest.webmanifest,
    // referenced from index.html via <link rel="manifest">, so the plugin's own
    // manifest generation is disabled here to avoid a second source of truth.
    VitePWA({
      registerType: 'prompt',
      // Registration is done manually via `virtual:pwa-register/react` (see
      // src/components/UpdatePrompt.tsx) so we control the "new version ready"
      // UI ourselves, matching the behaviour ported from the legacy sw.js.
      injectRegister: false,
      manifest: false,
      workbox: {
        // Precache everything Vite emits, including the three self-hosted
        // woff2 fonts (app/src/assets/fonts/*) and the manifest/icon copied
        // from public/.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest}'],
        // IMPORTANT: vite-plugin-pwa's own default is `navigateFallback:
        // 'index.html'` — simply omitting this key does NOT disable it, it
        // inherits that default (confirmed by inspecting the generated
        // dist/sw.js, which registered a NavigationRoute until this line was
        // added). This app is hash-routed (see src/lib/router.ts), so every
        // route is a request for the same document and a fallback buys
        // nothing offline. Worse, a service worker's scope is a path
        // *prefix* — once this SPA is cut over to serve from `/honeymoon/`,
        // its worker also controls `/honeymoon/legacy/`, the frozen rollback
        // snapshot. A navigateFallback would intercept navigations to
        // /honeymoon/legacy/ and answer them with this SPA's own index.html,
        // silently taking out the rollback path through the exact mechanism
        // it depends on — and because it's a service worker, it would keep
        // doing so after a `git revert` until the worker updates on-device.
        // Explicitly undefined here overrides the plugin default via its
        // `Object.assign(defaults, userWorkbox)` merge. If a fallback ever
        // becomes unavoidable, it must ship with
        // `navigateFallbackDenylist: [/^\/honeymoon\/legacy\//]`.
        navigateFallback: undefined,
        // Live data — never runtime-cache. A stale cached response for
        // weather, exchange rates or the GitHub sync API is worse than an
        // error. Ported from the root sw.js's isShell/live-data bypass.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.hostname === 'api.github.com' ||
              url.hostname.endsWith('open-meteo.com') ||
              url.hostname.endsWith('er-api.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    // The IndexedDB harness exposes a delete primitive against the real
    // object store. It must never reach a production build or the deployed
    // site — it exists only so Playwright can exercise idb* in a real
    // browser, since jsdom has no IndexedDB.
    ...(e2e
      ? { rollupOptions: { input: { main: 'index.html', idbHarness: 'idb-harness.html' } } }
      : {}),
  },
  test: { environment: 'jsdom', exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'] },
});
