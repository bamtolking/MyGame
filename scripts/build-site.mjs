#!/usr/bin/env node
// 게임 허브 사이트 빌드.
//   1) games.json 에 적힌 게임을 빌드해 _site/<slug>/ 로 모은다. 게임은 세 종류:
//      - 복사본 게임 (기본): games/<slug>/ 에서 npm ci + 빌드. 원본 브랜치가 바뀌어도 자동으로 따라가지 않는다.
//      - live 게임 ("live" 항목): 빌드할 때마다 원본 브랜치(branch)의 최신 커밋을 받아 .live/<slug>/ 에 풀고
//        그 안의 live.dir 폴더에서 npm ci + 빌드한다. 원본 브랜치에 push 한 뒤 배포 워크플로만 다시 실행하면
//        main 병합 없이 주소에 바로 반영된다. 빌드가 실패하면 브랜치에 커밋된 단일 파일(live.fallback)을 대신 올린다.
//      - 로블록스 게임 ("kind": "roblox"): 브랜치의 실행 파일(.rbxlx)과 미리보기 그림을 복사하고 다운로드 페이지를 만든다.
//   2) hub/index.html 템플릿에 게임 카드를 채워 _site/index.html (첫 화면)을 만든다.
//   3) _site/versions.json 에 게임별로 배포된 버전(원본 브랜치 커밋)을 적는다.
// 사용법:  node scripts/build-site.mjs            # 전체
//          node scripts/build-site.mjs last-exit  # 일부 게임만 (허브 첫 화면은 항상 다시 생성)
//   환경변수 SKIP_INSTALL=1 → 복사본 게임의 npm ci 생략 (로컬에서 이미 설치한 경우. live 게임은 항상 설치)
//            SKIP_FETCH=1   → live 게임의 git fetch 생략 (이미 받아 둔 origin/<branch> 를 그대로 사용)
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8'));
const out = join(root, '_site');
const liveRoot = join(root, '.live');
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const skipInstall = process.env.SKIP_INSTALL === '1';
const skipFetch = process.env.SKIP_FETCH === '1';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

for (const slug of only) if (!cfg.games.some((g) => g.slug === slug)) fail(`games.json 에 없는 게임: ${slug}`);
if (only.length === 0) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 일부만 다시 빌드할 때는 나머지 게임의 버전 기록을 유지
const versionsFile = join(out, 'versions.json');
const versions = only.length && existsSync(versionsFile) ? JSON.parse(readFileSync(versionsFile, 'utf8')).games ?? {} : {};

const site = cfg.site;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kst = (iso) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const fill = (tpl) => tpl
  .replaceAll('{{SITE_TITLE}}', esc(site.title))
  .replaceAll('{{SITE_DESCRIPTION}}', esc(site.description))
  .replaceAll('{{GAME_COUNT}}', String(cfg.games.length))
  .replaceAll('{{REPO_URL}}', esc(site.repo))
  .replaceAll('{{BASE_PATH}}', esc(site.basePath));

const results = [];
for (const g of cfg.games) {
  if (only.length && !only.includes(g.slug)) continue;
  console.log(`\n=== [${g.slug}] ${g.title} ===`);
  const t0 = Date.now();
  const dest = join(out, g.slug);
  rmSync(dest, { recursive: true, force: true });
  let mode = 'build';
  let src = null;

  if (g.live) {
    src = checkoutLive(g);
    console.log(`원본: ${g.branch} @ ${src.sha.slice(0, 7)} (${src.date}) ${src.subject}`);
    try { run(`node "${join(root, 'scripts', 'check-secrets.mjs')}" --dir "${src.cwd}"`, root); }
    catch { fail(`${g.slug}: ${g.branch} 브랜치에서 민감정보 의심 항목이 나와 배포를 멈춥니다 (위 목록 확인)`); }
  }

  if (g.kind === 'roblox') {
    buildRobloxPage(g, src, dest);
    mode = 'download';
  } else {
    const cwd = src ? src.cwd : join(root, 'games', g.slug);
    if (!existsSync(cwd)) fail(`${g.slug}: 폴더가 없습니다 (${cwd})`);
    let built;
    if (g.build.prebuilt) {
      // 정식 개발 게임: Private 저장소에서 빌드된 결과물만 이 폴더에 들어 있음 → 그대로 복사
      console.log('(prebuilt) 빌드 없이 폴더를 그대로 복사');
      built = cwd;
      mode = 'prebuilt';
      if (!existsSync(join(built, 'index.html'))) fail(`${g.slug}: index.html 이 없습니다`);
    } else {
      try {
        if (g.build.install && (src || !skipInstall)) run('npm ci --no-audit --no-fund', cwd);
        run(g.build.command, cwd);
        built = join(cwd, g.build.outDir);
        if (!existsSync(join(built, 'index.html'))) throw new Error(`${g.build.outDir}/index.html 이 없습니다`);
      } catch (e) {
        // live 게임만: 빌드가 깨져도 브랜치에 커밋된 단일 파일로 계속 플레이할 수 있게 한다
        const fb = src && g.live.fallback ? join(cwd, g.live.fallback) : null;
        if (!fb || !existsSync(fb)) fail(`${g.slug}: 빌드 실패 — ${e.message}`);
        console.warn(`::warning title=${g.slug} 빌드 실패::${e.message} → 브랜치의 ${g.live.fallback} 단일 파일로 대신 배포합니다`);
        built = join(liveRoot, `${g.slug}.fallback`);
        rmSync(built, { recursive: true, force: true });
        mkdirSync(built, { recursive: true });
        cpSync(fb, join(built, 'index.html'));
        mode = 'fallback';
      }
    }
    cpSync(built, dest, { recursive: true, filter: (p) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(p) });
    if (g.live?.hubSw) {
      // 원본 sw.js 는 캐시를 먼저 보여 줘서 업데이트 직후 옛 버전이 뜨고, 다른 게임의 캐시까지 지운다 → 허브 표준 워커로 교체
      writeFileSync(join(dest, 'sw.js'), hubServiceWorker(g.slug));
    }
  }

  versions[g.slug] = {
    title: g.title,
    path: `${cfg.site.basePath}${g.slug}/`,
    mode,
    ...(src ? { branch: g.branch, commit: src.sha, date: src.date, subject: src.subject } : {}),
  };
  results.push({ slug: g.slug, mode, seconds: ((Date.now() - t0) / 1000).toFixed(1), sha: src?.sha });
}

// 허브 첫 화면
const card = (g) => {
  const v = versions[g.slug];
  const roblox = g.kind === 'roblox';
  const orient = { landscape: '📱 가로 화면', any: '📱 세로·가로' }[g.orientation] ?? '📱 세로 화면';
  const tags = [
    roblox ? '<span class="tag">🧱 로블록스 · PC/Mac Studio</span>' : `<span class="tag">${orient}</span>`,
    g.pwa ? '<span class="tag pwa">🏠 홈 화면 설치 · 오프라인</span>' : '',
    g.live && v?.date ? `<span class="tag live">🔄 자동 업데이트 · ${esc(kst(v.date))}</span>` : '',
  ].filter(Boolean).join('');
  // live 게임은 커밋마다 주소 뒤 ?v= 가 바뀌어 브라우저 캐시(최대 10분) 때문에 옛 버전이 뜨지 않는다
  const href = `./${g.slug}/${g.live && v?.commit ? `?v=${v.commit.slice(0, 7)}` : ''}`;
  return `    <article class="card${roblox ? ' roblox' : ''}" data-slug="${esc(g.slug)}">
      <div class="icon" aria-hidden="true">${esc(g.emoji)}</div>
      <h2>${esc(g.title)}</h2>
      <p>${esc(g.tagline)}</p>
      <div class="tags">${tags}</div>
      <a class="play" href="${esc(href)}" aria-label="${esc(g.title)} ${roblox ? '다운로드' : '플레이'}">${roblox ? '실행 파일 받기 ⬇' : '플레이 ▶'}</a>
    </article>`;
};
writeFileSync(join(out, 'index.html'), fill(readFileSync(join(root, 'hub', 'index.html'), 'utf8')).replace('<!--GAME_CARDS-->', cfg.games.map(card).join('\n')));
writeFileSync(join(out, '404.html'), fill(readFileSync(join(root, 'hub', '404.html'), 'utf8')));
writeFileSync(join(out, '.nojekyll'), '');
writeFileSync(versionsFile, JSON.stringify({ builtAt: new Date().toISOString(), games: versions }, null, 2) + '\n');

console.log('\n=== 완료 ===');
for (const r of results) console.log(`  ${r.slug.padEnd(20)} ${r.mode.padEnd(8)} ${r.seconds}s → _site/${r.slug}/${r.sha ? `  (${r.sha.slice(0, 7)})` : ''}`);
console.log(`  허브 첫 화면           → _site/index.html (게임 ${cfg.games.length}개), _site/versions.json`);
console.log(`\n미리보기: npm run preview  →  http://localhost:8080${site.basePath}`);
writeSummary();

// 원본 브랜치의 최신 커밋을 받아 .live/<slug>/ 에 푼다 (원본 브랜치는 읽기만 한다)
function checkoutLive(g) {
  const ref = `refs/remotes/origin/${g.branch}`;
  if (!skipFetch) {
    // CI 의 얕은 클론이면 얕게 받는다. 전체 클론에서 --depth 를 쓰면 저장소가 얕아지므로 쓰지 않는다.
    const shallow = git('rev-parse', '--is-shallow-repository').trim() === 'true';
    try { git('fetch', '--no-tags', ...(shallow ? ['--depth=1'] : []), 'origin', `+refs/heads/${g.branch}:${ref}`); }
    catch (e) { fail(`${g.slug}: 원본 브랜치 ${g.branch} 를 받을 수 없습니다 (브랜치가 지워졌으면 games.json 의 branch 를 고치세요) — ${e.message}`); }
  }
  const [sha, date, ...subject] = git('log', '-1', '--format=%H%n%cI%n%s', ref).trim().split('\n');
  const dir = g.live.dir || '.';
  const base = join(liveRoot, g.slug);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', ref, ...(dir === '.' ? [] : ['--', dir])], { cwd: root, maxBuffer: 1024 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', base], { input: tar, maxBuffer: 64 * 1024 * 1024 });
  const cwd = join(base, dir);
  if (!existsSync(cwd)) fail(`${g.slug}: ${g.branch} 브랜치에 ${dir}/ 폴더가 없습니다`);
  return { sha, date, subject: subject.join(' '), cwd };
}

// 로블록스 게임: 실행 파일 + 미리보기 그림 + 안내 페이지 (hub/roblox.html)
function buildRobloxPage(g, src, dest) {
  if (!src) fail(`${g.slug}: 로블록스 게임은 live 항목(원본 브랜치)이 필요합니다`);
  const file = join(src.cwd, g.download.file);
  if (!existsSync(file)) fail(`${g.slug}: ${g.branch} 브랜치에 ${g.live.dir}/${g.download.file} 이 없습니다`);
  mkdirSync(join(dest, 'img'), { recursive: true });
  const name = basename(file);
  cpSync(file, join(dest, name));
  const images = (g.download.images ?? []).filter((p) => existsSync(join(src.cwd, p)));
  for (const p of images) cpSync(join(src.cwd, p), join(dest, 'img', basename(p)));
  const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
  const docUrl = `${site.repo}/blob/${g.branch}/${g.live.dir}/README.md`;
  const html = fill(readFileSync(join(root, 'hub', 'roblox.html'), 'utf8'))
    .replaceAll('{{GAME_TITLE}}', esc(g.title))
    .replaceAll('{{GAME_TAGLINE}}', esc(g.tagline))
    .replaceAll('{{GAME_EMOJI}}', esc(g.emoji))
    .replaceAll('{{FILE_NAME}}', esc(name))
    .replaceAll('{{FILE_HREF}}', esc(`./${name}?v=${src.sha.slice(0, 7)}`))
    .replaceAll('{{FILE_SIZE}}', `${mb}MB`)
    .replaceAll('{{UPDATED}}', esc(kst(src.date)))
    .replaceAll('{{COMMIT}}', esc(src.sha.slice(0, 7)))
    .replaceAll('{{DOC_URL}}', esc(docUrl))
    .replace('<!--PREVIEW_IMAGES-->', images.map((p) => `      <img src="./img/${esc(basename(p))}" alt="" loading="lazy" />`).join('\n'));
  writeFileSync(join(dest, 'index.html'), html);
  console.log(`실행 파일 ${name} (${mb}MB), 미리보기 그림 ${images.length}장 → _site/${g.slug}/`);
}

// 네트워크 우선 서비스 워커: 업데이트가 바로 보이고, 오프라인일 때만 캐시를 쓴다. 캐시는 이 게임 것만 관리한다.
function hubServiceWorker(slug) {
  return `// 게임 허브가 원본 sw.js 대신 넣은 서비스 워커 (scripts/build-site.mjs 가 생성).
// 항상 네트워크에서 먼저 받아 업데이트가 바로 보이고, 오프라인일 때만 캐시를 쓴다. 다른 게임의 캐시는 건드리지 않는다.
const CACHE = 'hub-${slug}-v1';
// 페이지 주소는 ?v= 를 떼고 저장해 오프라인일 때 마지막으로 연 버전이 뜨게 한다
const pageKey = (url) => { const u = new URL(url); u.search = ''; u.hash = ''; return u.href; };
self.addEventListener('install', (e) => {
  self.skipWaiting();
  // 첫 방문 직후에도 오프라인으로 열리도록 시작 페이지와 그 페이지가 부르는 파일(./assets/… 등)을 미리 저장
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    const res = await fetch('./', { cache: 'no-cache' });
    if (!res.ok) return;
    const html = await res.clone().text();
    await c.put(pageKey(new URL('./', location.href).href), res);
    const files = [...new Set([...html.matchAll(/(?:src|href)="(\\.\\/[^"#?]+)"/g)].map((m) => m[1]))];
    await Promise.all(files.map((f) => c.add(f).catch(() => {})));
  }).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hub-${slug}-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  const key = nav ? pageKey(req.url) : req;
  e.respondWith((nav ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req))
    .then((res) => {
      if (nav && res.redirected) return Response.redirect(res.url, 302);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    })
    .catch(async () => (await caches.match(key)) || (nav && (await caches.match(pageKey(new URL('./', location.href).href)))) || Response.error()));
});
`;
}

// GitHub Actions 실행 요약: 게임별 배포 버전
function writeSummary() {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const pageUrl = `https://${site.repo.split('/')[3]}.github.io${site.basePath}`;
  const rows = results.map((r) => {
    const v = versions[r.slug];
    const src = v.commit ? `\`${v.branch}\` @ \`${v.commit.slice(0, 7)}\` (${kst(v.date)})` : '`games/' + r.slug + '/` 복사본';
    const warn = r.mode === 'fallback' ? ' ⚠️ 빌드 실패 → 단일 파일' : '';
    return `| [${v.title}](${pageUrl}${r.slug}/) | ${r.mode}${warn} | ${src} |`;
  });
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`### 게임 허브 빌드 — ${pageUrl}`, '', '| 게임 | 방식 | 원본 |', '|---|---|---|', ...rows, ''].join('\n'));
}

function run(cmd, cwd) {
  console.log(`$ (${cwd.replace(root + '/', '')}) ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: process.env.CI ?? '1' } });
}
function fail(msg) { console.error('빌드 실패: ' + msg); process.exit(1); }
