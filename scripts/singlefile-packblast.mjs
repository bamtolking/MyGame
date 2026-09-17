// 팩 앤 블래스트 빌드 결과(dist/packblast/index.html + assets)를 단일 HTML(play/packblast.html)로 합친다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const src = join('dist', 'packblast', 'index.html');
if (!existsSync(src)) { console.error('dist/packblast/index.html 없음 — 먼저 vite build'); process.exit(1); }
let html = readFileSync(src, 'utf8');
// 이 페이지가 참조하는 자산만 인라인 (경로는 ../assets/xxx)
html = html.replace(/<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/g, (_, p) => `<script type="module">${readFileSync(join('dist', 'packblast', p), 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`);
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g, (_, p) => `<style>${readFileSync(join('dist', 'packblast', p), 'utf8')}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'packblast.html'), html);
console.log('play/packblast.html written:', (html.length / 1024).toFixed(0), 'KB');
