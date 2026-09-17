import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: true, port: 5173 },
});
