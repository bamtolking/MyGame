import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  test: {
    root,
    include: ['tests/**/*.test.ts'],
    testTimeout: 600000,
  },
});
