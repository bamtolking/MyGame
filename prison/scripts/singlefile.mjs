// Inline built JS/CSS into a single self-contained HTML (play/index.html) for phone testing / artifact publishing.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => `<script type="module">${content.replace(/<\/script>/g, '<\\/script>')}</script>`);
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html written:', (html.length / 1024).toFixed(0), 'KB');
const inner = html.replace(/^[\s\S]*?<head>/, '').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta charset="utf-8" \/>\s*/, '').replace(/<link rel="icon" href="[^"]*"\s*\/>\s*/, '').replace(/<title>[^<]*<\/title>/, '<title>감옥 설계자</title>');
writeFileSync(join('play', 'artifact.html'), inner.trim() + '\n');
console.log('play/artifact.html written:', (inner.length / 1024).toFixed(0), 'KB');
