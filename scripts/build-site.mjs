#!/usr/bin/env node
// 게임 허브 사이트 빌드.
//   1) games.json 에 적힌 게임을 games/<slug>/ 에서 각각 빌드하고 (npm ci + build 명령)
//   2) 빌드 결과를 _site/<slug>/ 로 복사한 뒤
//   3) hub/index.html 템플릿에 게임 카드를 채워 _site/index.html (첫 화면)을 만든다.
// 사용법:  node scripts/build-site.mjs            # 전체
//          node scripts/build-site.mjs last-exit  # 일부 게임만 (허브 첫 화면은 항상 다시 생성)
//   환경변수 SKIP_INSTALL=1 → npm ci 생략 (로컬에서 이미 설치한 경우)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8'));
const out = join(root, '_site');
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const skipInstall = process.env.SKIP_INSTALL === '1';

for (const slug of only) if (!cfg.games.some((g) => g.slug === slug)) fail(`games.json 에 없는 게임: ${slug}`);
if (only.length === 0) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const results = [];
for (const g of cfg.games) {
  if (only.length && !only.includes(g.slug)) continue;
  const dir = join(root, 'games', g.slug);
  if (!existsSync(dir)) fail(`${g.slug}: 폴더가 없습니다 (${dir})`);
  console.log(`\n=== [${g.slug}] ${g.title} ===`);
  const t0 = Date.now();
  if (g.build.install && !skipInstall) run('npm ci --no-audit --no-fund', dir);
  run(g.build.command, dir);
  const built = join(dir, g.build.outDir);
  if (!existsSync(join(built, 'index.html'))) fail(`${g.slug}: ${g.build.outDir}/index.html 이 생성되지 않았습니다`);
  const dest = join(out, g.slug);
  rmSync(dest, { recursive: true, force: true });
  cpSync(built, dest, { recursive: true, filter: (src) => !/[\\/]node_modules([\\/]|$)/.test(src) });
  results.push({ slug: g.slug, seconds: ((Date.now() - t0) / 1000).toFixed(1) });
}

// 허브 첫 화면
const site = cfg.site;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const card = (g) => {
  const tags = [
    g.orientation === 'landscape' ? '📱 가로 화면' : '📱 세로 화면',
    g.pwa ? '<span class="tag pwa">🏠 홈 화면 설치 · 오프라인</span>' : '',
  ].filter(Boolean).map((t) => (t.startsWith('<') ? t : `<span class="tag">${t}</span>`)).join('');
  return `    <article class="card" data-slug="${esc(g.slug)}">
      <div class="icon" aria-hidden="true">${esc(g.emoji)}</div>
      <h2>${esc(g.title)}</h2>
      <p>${esc(g.tagline)}</p>
      <div class="tags">${tags}</div>
      <a class="play" href="./${esc(g.slug)}/" aria-label="${esc(g.title)} 플레이">플레이 ▶</a>
    </article>`;
};
const fill = (tpl) => tpl
  .replaceAll('{{SITE_TITLE}}', esc(site.title))
  .replaceAll('{{SITE_DESCRIPTION}}', esc(site.description))
  .replaceAll('{{GAME_COUNT}}', String(cfg.games.length))
  .replaceAll('{{REPO_URL}}', esc(site.repo))
  .replaceAll('{{BASE_PATH}}', esc(site.basePath));
writeFileSync(join(out, 'index.html'), fill(readFileSync(join(root, 'hub', 'index.html'), 'utf8')).replace('<!--GAME_CARDS-->', cfg.games.map(card).join('\n')));
writeFileSync(join(out, '404.html'), fill(readFileSync(join(root, 'hub', '404.html'), 'utf8')));
writeFileSync(join(out, '.nojekyll'), '');

console.log('\n=== 완료 ===');
for (const r of results) console.log(`  ${r.slug.padEnd(16)} ${r.seconds}s → _site/${r.slug}/`);
console.log(`  허브 첫 화면      → _site/index.html (게임 ${cfg.games.length}개)`);
console.log(`\n미리보기: npm run preview  →  http://localhost:8080${site.basePath}`);

function run(cmd, cwd) {
  console.log(`$ (${cwd.replace(root + '/', '')}) ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: process.env.CI ?? '1' } });
}
function fail(msg) { console.error('빌드 실패: ' + msg); process.exit(1); }
