// 헤드리스 Chromium으로 솔로 플레이 + 2인 협동 방을 실기동 검증하고 스크린샷을 남깁니다.
// 사용: npm run e2e   (playwright-core는 상위 저장소 node_modules 것을 재사용)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
let chromium;
for (const cand of ['playwright-core', path.join(ROOT, '..', 'node_modules', 'playwright-core'), 'playwright']) {
  try { chromium = require(cand).chromium; break; } catch {}
}
if (!chromium) { console.error('playwright-core를 찾을 수 없어요. 상위 폴더에서 npm install 하세요.'); process.exit(1); }
const OUT = path.join(ROOT, 'e2e-out'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 18080 + Math.floor(Math.random() * 1000);

const server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('실행 중')) res(); }));
const URL = `http://127.0.0.1:${PORT}/`;

const launchOpts = { headless: true };
if (process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'))) launchOpts.executablePath = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium');
const browser = await chromium.launch(launchOpts);
const errors = [];
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const newPage = async (opts = phone) => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  return page;
};
const assert = (cond, msg) => { if (!cond) throw new Error('검증 실패: ' + msg); console.log('  ✓ ' + msg); };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
// 내 위치에서 막히지 않은 방향으로 0.7초 이동
async function moveFree(page) {
  const dir = await page.evaluate(() => {
    const { S, view } = window.__dh; const me = view.me(S.myId);
    const tx = Math.floor(me.x), ty = Math.floor(me.y);
    const solid = new Set([1, 2, 3, 4, 5, 6, 8, 9]);
    for (const [k, dx, dy] of [['ArrowRight', 1, 0], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowUp', 0, -1]]) {
      if (!solid.has(view.tileAt(tx + dx, ty + dy)) && !solid.has(view.tileAt(tx + dx * 2, ty + dy * 2))) return k;
    }
    return 'ArrowDown';
  });
  await page.keyboard.down(dir); await page.waitForTimeout(700); await page.keyboard.up(dir);
  return dir;
}

try {
  // ---------- 1. 솔로 ----------
  console.log('1) 솔로 플레이');
  const p1 = await newPage();
  await p1.fill('#name', '테스터');
  await shot(p1, '01-menu');
  await p1.click('#btn-solo');
  await p1.waitForSelector('#screen-setup:not(.hidden)');
  await p1.click('#setup-map .card[data-key="SWAMP"]');
  await p1.click('#setup-diff .card[data-key="EASY"]');
  await p1.click('#setup-class .card[data-key="LUMBERJACK"]');
  await shot(p1, '00-setup');
  await p1.click('#setup-start');
  await p1.waitForFunction(() => window.__dh && window.__dh.view.ready);
  const cfg = await p1.evaluate(() => ({ map: window.__dh.view.map, diff: window.__dh.view.difficulty, cls: window.__dh.view.me(window.__dh.S.myId).cls, w: window.__dh.view.w }));
  assert(cfg.map === 'SWAMP' && cfg.diff === 'EASY' && cfg.cls === 'LUMBERJACK' && cfg.w === 96, `설정 반영: ${JSON.stringify(cfg)}`);
  await p1.waitForTimeout(500);
  await shot(p1, '02-solo-day');
  const me0 = await p1.evaluate(() => window.__dh.view.me(window.__dh.S.myId));
  assert(me0 && me0.name === '테스터', '내 플레이어가 생성됨');
  // 키보드로 이동
  await moveFree(p1);
  const me1 = await p1.evaluate(() => window.__dh.view.me(window.__dh.S.myId));
  assert(Math.hypot(me1.x - me0.x, me1.y - me0.y) > 0.5, '키보드 입력으로 이동함');
  // 건설 패널 → 나무 벽 선택 → 캔버스 탭
  await p1.click('#btn-build');
  await p1.waitForSelector('#buildpanel:not(.hidden)');
  await shot(p1, '03-build-panel');
  await p1.click('.bitem[data-key="WOOD_WALL"]');
  const placed = await p1.evaluate(() => {
    const { S, view } = window.__dh; const me = view.me(S.myId);
    // 내 위치 기준 범위 안의 빈 풀밭 하나를 골라 화면 좌표로 탭
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.floor(me.x) + dx, ty = Math.floor(me.y) + dy;
      if (view.tileAt(tx, ty) === 0 && (dx || dy) && Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y) > 1) { S.session.build('WOOD_WALL', tx, ty); return [tx, ty]; }
    }
    return null;
  });
  assert(placed, '벽 배치 요청');
  await p1.waitForTimeout(150);
  const wallTile = await p1.evaluate(([tx, ty]) => window.__dh.view.tileAt(tx, ty), placed);
  assert(wallTile === 5, '나무 벽이 지어짐 (타일=' + wallTile + ')');
  // 캔버스 탭으로 건설 (실제 터치 경로)
  const tapTarget = await p1.evaluate(() => {
    const { S, view } = window.__dh; const me = view.me(S.myId);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.floor(me.x) + dx, ty = Math.floor(me.y) + dy;
      if (view.tileAt(tx, ty) === 0 && Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y) > 1) return [tx, ty];
    }
    return null;
  });
  const tapPos = await p1.evaluate(([tx, ty]) => { const c = window.__dh; const cam = c.S; void cam; return null; }, tapTarget);
  void tapPos;
  // 화면 좌표 계산은 renderer 내부 카메라를 사용 → 페이지 안에서 클릭 좌표 산출
  const [sx, sy] = await p1.evaluate(([tx, ty]) => { const r = window.__dh.renderer; return [(tx + 0.5 - r.cam.x) * r.ts + r.W / 2, (ty + 0.5 - r.cam.y) * r.ts + r.H / 2]; }, tapTarget);
  await p1.touchscreen.tap(sx, sy);
  await p1.waitForTimeout(150);
  const tapped = await p1.evaluate(([tx, ty]) => window.__dh.view.tileAt(tx, ty), tapTarget);
  assert(tapped === 5, '터치 탭으로 벽이 지어짐');
  await p1.click('#btn-build'); // 건설 취소
  // 채집 모션: 옆에 나무를 두고 액션 버튼을 누른 채 스크린샷
  await p1.evaluate(() => { const { S, view } = window.__dh; const g = S.session.game; const me = g.players.get(S.myId); const tx = Math.floor(me.x) + 1, ty = Math.floor(me.y); g.setTile(g.idx(tx, ty), 1); me.dx = 1; me.dy = 0; view.applyDelta(g.delta()); });
  const ab = await p1.$('#btn-action'); const abb = await ab.boundingBox();
  await p1.touchscreen.tap(abb.x + abb.width / 2, abb.y + abb.height / 2);
  await p1.mouse.move(abb.x + abb.width / 2, abb.y + abb.height / 2); await p1.mouse.down();
  await p1.waitForTimeout(120); await shot(p1, '03b-gather'); await p1.mouse.up();
  const swung = await p1.evaluate(() => window.__dh.view.me(window.__dh.S.myId).swingKind);
  assert(swung === 'tree' || swung === 'miss', '채집 동작 발생 (' + swung + ')');
  // 밤으로 빨리감기
  await p1.evaluate(() => { const g = window.__dh.S.session.game; const C = window.__dh.C; for (let i = 0; i < g.dayTicks + C.TICK_RATE * 12; i++) g.tick(); window.__dh.view.applyDelta(g.delta()); });
  await p1.waitForTimeout(400);
  const night = await p1.evaluate(() => ({ phase: window.__dh.view.phase, enemies: window.__dh.view.enemies.length }));
  assert(night.phase === 'night' && night.enemies > 0, `밤 + 적 출현 (${night.enemies}마리)`);
  await shot(p1, '04-solo-night');
  // 먹기 / 채팅
  await p1.click('#btn-eat'); await p1.click('#btn-chat'); await p1.click('#chatlist button');
  await p1.waitForTimeout(200);
  const say = await p1.evaluate(() => window.__dh.view.me(window.__dh.S.myId).say);
  assert(say === '도와줘!', '빠른 채팅 말풍선');
  await shot(p1, '05-solo-chat');
  // 게임 오버 → 오버레이
  await p1.evaluate(() => { const g = window.__dh.S.session.game; for (const p of g.players.values()) p.hp = 0; g.tick(); window.__dh.view.applyDelta(g.delta()); });
  await p1.waitForSelector('#overlay:not(.hidden)');
  await shot(p1, '06-solo-gameover');
  assert(true, '게임 오버 오버레이 표시');
  await p1.click('#btn-again');
  await p1.waitForFunction(() => !window.__dh.view.over);
  assert(true, '다시 하기로 새 게임 시작');

  // ---------- 2. 협동 ----------
  console.log('2) 협동 (방 만들기 → 참가 → 시작)');
  const host = await newPage();
  await host.fill('#name', '방장');
  await host.click('#btn-create');
  await host.waitForSelector('#screen-lobby:not(.hidden)');
  const code = await host.textContent('#lobby-code');
  assert(/^[A-Z0-9]{4}$/.test(code), '방 코드 발급: ' + code);
  await shot(host, '07-lobby-host');
  const guest = await newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await guest.fill('#name', '친구');
  await guest.fill('#code', code.toLowerCase());
  await guest.click('#btn-join');
  await guest.waitForSelector('#screen-lobby:not(.hidden)');
  await host.waitForFunction(() => document.querySelectorAll('#lobby-members li').length === 2);
  assert(true, '참가자가 대기실에 표시됨');
  assert(await guest.isHidden('#btn-start'), '참가자는 시작 버튼이 없음');
  // 잘못된 코드
  const bad = await newPage();
  await bad.fill('#code', 'ZZZZ'); await bad.click('#btn-join');
  await bad.waitForFunction(() => document.getElementById('menu-msg').textContent.includes('없어요'));
  assert(true, '없는 코드는 오류 메시지');
  await bad.context().close();
  await host.click('#lobby-map .card[data-key="SNOW"]');
  await guest.waitForFunction(() => document.querySelector('#lobby-map .card.selected')?.dataset.key === 'SNOW');
  assert(true, '방장의 전장 선택이 참가자에게 동기화됨');
  assert(await guest.$eval('#lobby-map .card[data-key="MEADOW"]', (b) => b.disabled), '참가자는 전장을 바꿀 수 없음');
  await guest.click('#lobby-class .card[data-key="KNIGHT"]');
  await host.waitForFunction(() => [...document.querySelectorAll('#lobby-members li')].some((li) => li.textContent.includes('🛡️')));
  assert(true, '참가자의 캐릭터 선택이 방장에게 표시됨');
  await shot(host, '07b-lobby-settings');
  await host.click('#btn-start');
  await host.waitForFunction(() => window.__dh.view.ready && window.__dh.view.players.length === 2);
  const netCfg = await guest.evaluate(() => ({ map: window.__dh.view.map, cls: window.__dh.view.me(window.__dh.S.myId).cls }));
  assert(netCfg.map === 'SNOW' && netCfg.cls === 'KNIGHT', '협동 게임에 전장/캐릭터 반영: ' + JSON.stringify(netCfg));
  await guest.waitForFunction(() => window.__dh.view.ready && window.__dh.view.players.length === 2);
  assert(true, '두 클라이언트 모두 게임 시작, 플레이어 2명');
  // 호스트가 이동 → 게스트 화면에도 반영
  const before = await guest.evaluate(() => { const p = window.__dh.view.players.find((p) => p.name === '방장'); return [p.x, p.y]; });
  await moveFree(host);
  await guest.waitForTimeout(300);
  const after = await guest.evaluate(() => { const p = window.__dh.view.players.find((p) => p.name === '방장'); return [p.x, p.y]; });
  assert(Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.5, '호스트 이동이 게스트에게 동기화됨');
  // 게스트가 벽 건설 → 호스트에 반영
  const gt = await guest.evaluate(() => {
    const { S, view } = window.__dh; const me = view.me(S.myId);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.floor(me.x) + dx, ty = Math.floor(me.y) + dy;
      if (view.tileAt(tx, ty) === 0 && Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y) > 1) { S.session.build('STONE_WALL', tx, ty); return [tx, ty]; }
    }
    return null;
  });
  await host.waitForFunction(([tx, ty]) => window.__dh.view.tileAt(tx, ty) === 6, gt);
  assert(true, '게스트가 지은 돌 벽이 호스트 화면에 동기화됨');
  await guest.click('#btn-chat'); await guest.click('#chatlist button:nth-child(2)');
  await host.waitForFunction(() => window.__dh.view.players.find((p) => p.name === '친구').say === '여기 벽 짓자');
  assert(true, '빠른 채팅 동기화');
  await host.waitForTimeout(300);
  await shot(host, '08-coop-host'); await shot(guest, '09-coop-guest-landscape');
  // 게스트 퇴장 → 호스트에 반영
  await guest.context().close();
  await host.waitForFunction(() => window.__dh.view.players.length === 1);
  assert(true, '게스트 퇴장 반영');
  await host.context().close();
  await p1.context().close();

  const real = errors.filter((e) => !/favicon/.test(e));
  assert(real.length === 0, '브라우저 콘솔 오류 없음' + (real.length ? '\n' + real.join('\n') : ''));
  console.log('\n모든 e2e 검증 통과. 스크린샷:', OUT);
} catch (err) {
  console.error('\n' + err.stack);
  if (errors.length) console.error('브라우저 오류:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
