import { defineConfig } from 'vite';

// 새 게임(합체방어대: 콤보 러시)은 game/ 폴더에 있습니다. 이전 게임(대박수비대)은 vite.legacy.config.ts 로 실행합니다.
export default defineConfig({
  root: 'game',
  base: './',
  publicDir: false,
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2019',
    outDir: '../dist',
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
