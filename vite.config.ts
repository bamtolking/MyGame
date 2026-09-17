import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two independent games share one toolchain:
//   /            → 대박수비대 (기존 게임, index.html)
//   /packblast/  → 가방이 무기다: 팩 앤 블래스트 (packblast/index.html)
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // 각 진입점이 자기 CSS만 갖도록 분리한다 (두 게임의 전역 스타일이 섞이지 않게).
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        packblast: resolve(__dirname, 'packblast/index.html'),
      },
      output: { manualChunks: undefined },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
