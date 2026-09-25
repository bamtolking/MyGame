// 빌드 결과(dist)를 파일 하나로 합친다: play/index.html (휴대폰에서 바로 열기) + play/artifact.html (claude.ai 아티팩트용).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => `<script>window.__NYANG_SINGLEFILE__=1</script>\n<script type="module">${content.replace(/<\/script>/g, '<\\/script>')}</script>`);
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
// 단일 파일에는 옆 파일이 없으니 매니페스트/아이콘 링크를 뺀다
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\s*/g, '');
const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M18 44 22 8 46 24M82 44 78 8 54 24' fill='#FFB44C'/><circle cx='50' cy='56' r='38' fill='#FFB44C'/><circle cx='36' cy='54' r='6' fill='#3B2415'/><circle cx='64' cy='54' r='6' fill='#3B2415'/></svg>";
const favicon = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`;
html = html.replace('</title>', '</title>\n  ' + favicon);
mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html:', (html.length / 1024).toFixed(0), 'KB');

// 아티팩트: doctype/html/head/body 없이 (호스트가 감싼다)
const inner = html
  .replace(/^[\s\S]*?<head>/, '')
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta charset="utf-8" \/>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<link rel="icon"[^>]*>\s*/, '');
writeFileSync(join('play', 'artifact.html'), inner.trim() + '\n');
console.log('play/artifact.html:', (inner.length / 1024).toFixed(0), 'KB');
