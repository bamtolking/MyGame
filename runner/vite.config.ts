import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

/**
 * Stamps dist/sw.js (copied from the public/sw.js template) with this build's id and the list of every emitted file:
 * a new build changes sw.js, so installed apps pick it up, and the hashed JS/CSS are cached on the very first visit
 * (they load before the service worker exists, so they would otherwise never reach the cache).
 */
function swVersion(): Plugin {
  let outDir = 'dist';
  const walk = (dir: string, pre = ''): string[] => readdirSync(dir).sort().flatMap(f => statSync(join(dir, f)).isDirectory() ? walk(join(dir, f), pre + f + '/') : [pre + f]);
  return {
    name: 'sw-version',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      const src = readFileSync(sw, 'utf8');
      const files = walk(outDir).filter(f => f !== 'sw.js');
      const h = createHash('sha256').update(src);   // (the worker's own code counts too)
      for (const f of files) h.update(f + '\0').update(readFileSync(join(outDir, f)));
      const build = h.digest('hex').slice(0, 12);
      const out = src.replace(/const BUILD = '[^']*';/, `const BUILD = '${build}';`)
        .replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(['./', ...files.map(f => './' + f)])};`);
      if (!out.includes(`'${build}'`) || out === src) throw new Error('sw-version: BUILD / PRECACHE markers not found in public/sw.js');
      writeFileSync(sw, out);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [swVersion()],
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
