import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/honeymoon/next/',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
  test: { environment: 'jsdom' },
});
