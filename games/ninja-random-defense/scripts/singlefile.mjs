// dist/index.html + assets → play/index.html (단일 파일; 휴대폰에서 파일로 열어도 실행)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const m = html.match(new RegExp(`<script[^>]*src="[^"]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`));
  if (m) { const js = readFileSync(join(assets, f), 'utf8'); html = html.replace(m[0], () => `<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script>`); }
  const l = html.match(new RegExp(`<link[^>]*href="[^"]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`));
  if (l && f.endsWith('.css')) { const css = readFileSync(join(assets, f), 'utf8'); html = html.replace(l[0], () => `<style>${css}</style>`); }
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '').replace(/<link rel="manifest"[^>]*>\s*/g, '');
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html written:', (html.length / 1024).toFixed(0), 'KB');
