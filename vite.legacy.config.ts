import { defineConfig } from 'vite';

// 이전 게임 「대박수비대: 합성 대폭주」(루트의 index.html, src/, tests/, scripts/, docs/, play/)를 그대로 실행하기 위한 설정.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist-legacy',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
});
