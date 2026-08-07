import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/honeymoon/next/',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Test-only entry: exercises IndexedDB helpers directly for the
        // Playwright suite (jsdom has no IndexedDB). Not linked from the app.
        idbHarness: fileURLToPath(new URL('./idb-harness.html', import.meta.url)),
      },
    },
  },
  test: { environment: 'jsdom', exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'] },
});
