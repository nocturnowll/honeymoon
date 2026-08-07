import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const e2e = process.env.E2E === '1';

export default defineConfig({
  base: '/honeymoon/next/',
  plugins: [react()],
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
