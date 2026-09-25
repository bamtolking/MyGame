// Inline the built JS/CSS into one self-contained HTML (play/index.html) — runs from a file, a phone, or an Artifact.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const f of readdirSync(join(dist, 'assets'))) {
  const content = readFileSync(join(dist, 'assets', f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => `<script type="module">${content.replace(/<\/script>/g, '<\\/script>')}</script>`);
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '').replace(/<link rel="manifest"[^>]*>\s*/g, '');
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html written:', (html.length / 1024).toFixed(0), 'KB');
