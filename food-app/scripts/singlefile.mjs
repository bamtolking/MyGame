// dist/를 하나의 HTML로 합친다: play/index.html(휴대폰에서 파일로 열기) + play/artifact.html(claude.ai Artifact용, 문서 골격 없이).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="[^"]*${f}"[^>]*></script>`), () => '');
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="[^"]*${f}"[^>]*>`), () => `<style>${content}</style>`);
}
// 스크립트는 본문 끝(요소들이 생긴 뒤)에 둔다.
const js = readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8').replace(/<\/script>/g, '<\\/script>'));
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '').replace('</body>', () => `<script type="module">${js.join('\n')}</script>\n</body>`);

mkdirSync('play', { recursive: true });
writeFileSync(join('play', 'index.html'), html);
console.log('play/index.html', (html.length / 1024).toFixed(0), 'KB');

// Artifact: 호스트가 doctype/head/body를 감싸므로 title·style·폰트·본문·스크립트만 남긴다.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[^<]*<\/title>/)[0];
const styles = head.match(/<style>[\s\S]*?<\/style>/g).join('\n');
const fonts = (head.match(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g) ?? []).join('\n');
const artifact = `${title}\n${fonts}\n${styles}\n${body.trim()}\n`;
writeFileSync(join('play', 'artifact.html'), artifact);
console.log('play/artifact.html', (artifact.length / 1024).toFixed(0), 'KB');
