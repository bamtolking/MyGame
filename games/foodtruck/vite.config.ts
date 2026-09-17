import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: false },
  preview: { port: 4174 },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
