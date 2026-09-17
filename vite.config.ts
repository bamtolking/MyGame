import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), legacy: resolve(__dirname, 'legacy/index.html') },
      output: { manualChunks: undefined },
    },
  },
  server: { host: true, proxy: { '/ws': { target: 'ws://localhost:8080', ws: true }, '/api': 'http://localhost:8080' } },
  test: {
    include: ['tests/**/*.test.ts', 'legacy/tests/rules.test.ts'],
    testTimeout: 120000,
  },
});
