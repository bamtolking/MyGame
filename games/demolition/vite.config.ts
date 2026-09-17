import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5174, host: true },
  preview: { port: 4174, host: true },
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
    testTimeout: 180000,
  },
});
