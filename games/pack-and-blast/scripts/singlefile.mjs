// 팩 앤 블래스트 빌드 결과(dist/index.html + assets)를 단일 HTML(play/index.html)로 합친다.
// (원본 브랜치에서는 dist/packblast/index.html → play/packblast.html 이었고, 허브에서는 이 폴더가 독립 프로젝트라 경로가 단순해졌다.)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const src = join('dist', 'index.html');
if (!existsSync(src)) { console.error('dist/index.html 없음 — 먼저 vite build'); process.exit(1); }
let html = readFileSync(src, 'utf8');
html = html.replace(/<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/g, (_, p) => `<script type="module">${readFileSync(join('dist', p), 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`);
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g, (_, p) => `<style>${readFileSync(join('dist', p), 'utf8')}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html written:', (html.length / 1024).toFixed(0), 'KB');
