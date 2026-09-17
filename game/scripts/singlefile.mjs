// 빌드 결과(dist/)의 JS/CSS 를 HTML 하나에 인라인해 game/play/index.html 로 저장합니다(휴대폰 전송·오프라인 실행용).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist';
if (!existsSync(join(dist, 'index.html'))) { console.error('dist/index.html 이 없습니다. 먼저 vite build 를 실행하세요.'); process.exit(1); }
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => `<script type="module">${content.replace(/<\/script>/g, '<\\/script>')}</script>`);
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
mkdirSync('game/play', { recursive: true });
writeFileSync(join('game/play', 'index.html'), html);
console.log('game/play/index.html 생성:', (html.length / 1024).toFixed(0), 'KB');
