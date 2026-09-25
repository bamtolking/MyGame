// 빌드 결과(dist)를 JS/CSS를 인라인한 단일 HTML(play/index.html)로 합친다. 휴대폰에 파일 하나만 보내도 실행된다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// 사용: node scripts/singlefile.mjs [distDir] [outDir]   (기본 dist → play)
const dist = process.argv[2] || 'dist';
const outDir = process.argv[3] || 'play';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => `<script type="module">${content.replace(/<\/script>/g, '<\\/script>')}</script>`);
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
// 단일 파일에서는 manifest/서비스워커를 쓰지 않는다
const single = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), single);
console.log(`${outDir}/index.html written:`, (single.length / 1024).toFixed(0), 'KB');
// Artifact 변형: doctype/html/head/body 없이(호스트가 감쌈) 제목·메타·스타일·앱·스크립트만.
const inner = single.replace(/^[\s\S]*?<head>/, '').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta charset="utf-8" \/>\s*/, '').replace(/<link rel="icon" href="[^"]*"\s*\/>\s*/, '');
writeFileSync(join(outDir, 'artifact.html'), inner.trim() + '\n');
console.log(`${outDir}/artifact.html written:`, (inner.length / 1024).toFixed(0), 'KB');
