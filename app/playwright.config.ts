import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173/honeymoon/next/' },
  webServer: {
    command: 'E2E=1 bun run vite build && bun run vite preview --port 4173',
    port: 4173,
    reuseExistingServer: false,
  },
});
