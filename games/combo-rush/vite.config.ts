import { defineConfig } from 'vite';

// 합체방어대: 콤보 러시 — 허브(games/combo-rush/)에서는 이 폴더 자체가 프로젝트 루트입니다.
// (원본 브랜치에서는 저장소 루트의 vite.config.ts 가 root: 'game' 으로 이 폴더를 가리켰습니다.)
export default defineConfig({
  base: './',
  publicDir: false,
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
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
    include: ['tests/**/*.test.ts'],
    testTimeout: 180000,
  },
});
