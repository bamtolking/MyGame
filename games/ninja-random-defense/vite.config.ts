import { defineConfig } from 'vite';

// 닌자 랜덤 디펜스 — 허브(games/ninja-random-defense/)에서는 이 폴더가 프로젝트 루트이고 진입점은 index.html 하나입니다.
// (원본 브랜치에서는 legacy/index.html(대박수비대)도 함께 빌드했지만 허브에는 games/daebak-defense/ 가 따로 있어 제외)
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: { output: { manualChunks: undefined } },
  },
  server: { host: true, proxy: { '/ws': { target: 'ws://localhost:8080', ws: true }, '/api': 'http://localhost:8080' } },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
