// claude.ai 아티팩트(웹 미리보기)용 빌드: dist-artifact/ 에 본문 조각 index.html + 에셋
// 아티팩트 환경은 자체 <html>/<head>/<body> 뼈대를 씌우고, 서비스 워커를 쓰지 않습니다.
import { execSync } from 'node:child_process';
import { readFileSync, renameSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist-artifact');
// 아티팩트는 .task 확장자를 서빙하지 않으므로 모델은 .wasm 이름으로 올립니다 (MediaPipe는 바이트만 읽음)
const MODEL_EXT = 'wasm';
execSync('node scripts/prepare-assets.mjs && npx vite build --outDir dist-artifact --emptyOutDir', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_MODEL_EXT: MODEL_EXT, VITE_NO_SW: '1' },
});
rmSync(join(out, 'sw.js'), { force: true });
rmSync(join(out, 'manifest.webmanifest'), { force: true });
for (const kind of ['lite', 'full']) {
  renameSync(join(out, `models/pose_landmarker_${kind}.task`), join(out, `models/pose_landmarker_${kind}.${MODEL_EXT}`));
}

const html = readFileSync(join(out, 'index.html'), 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g);
const styles = pick(/<link rel="stylesheet"[^>]*>/g);
const scripts = pick(/<script type="module"[^>]*><\/script>/g);
const fragment = [
  ...title,
  '<meta name="theme-color" content="#f3f4f6">',
  ...styles,
  '<div id="app"></div>',
  ...scripts,
].join('\n');
writeFileSync(join(out, 'index.html'), fragment + '\n');

// 게시용 파일 목록 (published path → source path)
const files = {};
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p !== join(out, 'index.html')) files[relative(out, p)] = relative(root, p);
  }
};
walk(out);
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1));
let total = 0;
for (const src of Object.values(files)) total += statSync(join(root, src)).size;
console.log(`[artifact] ${Object.keys(files).length} files, ${(total / 1e6).toFixed(1)} MB`);
