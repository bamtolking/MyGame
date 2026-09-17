import { defineConfig } from 'vite';

// 가방이 무기다: 팩 앤 블래스트 — 허브(games/pack-and-blast/)에서는 독립 프로젝트입니다.
// (원본 브랜치에서는 대박수비대와 같은 vite.config.ts 의 두 번째 진입점 packblast/index.html 이었습니다.)
export default defineConfig({
  base: './',
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
