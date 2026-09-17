// 실제 브라우저(헤드리스 Chromium, 휴대폰 뷰포트) 테스트: 솔로 / WebSocket 협동(2명) / P2P 협동(2명, 로컬 PeerServer)
// 사전: npm run build (dist/). 실행: npm run e2e  → 스크린샷 e2e-out/
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, resolve } from 'node:path';
import { PeerServer } from 'peer';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const report = []; const log = (m) => { console.log(m); report.push(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) 게임 서버(WS) 2) 정적 서버(P2P용, /api/ping 없음) 3) PeerServer
const { startServer } = await import('../server/index.ts');
const WS_PORT = 18080, STATIC_PORT = 18081, PEER_PORT = 18082;
const game = startServer(WS_PORT, resolve('dist'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const stat = createServer((req, res) => { let p = req.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; const f = join('dist', p); try { statSync(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); } catch { res.writeHead(404); res.end(); } }).listen(STATIC_PORT);
const peerSrv = PeerServer({ port: PEER_PORT, path: '/peer', host: '127.0.0.1' });
await sleep(300);

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--allow-insecure-localhost'] });
let errors = 0;
async function newPage(name, viewport = { width: 390, height: 844 }, storage = null) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => { errors++; log(`[${name}] pageerror: ${e.message}`); });
  page.on('console', m => { const url = m.location()?.url || ''; if (m.type() === 'error' && !/favicon|manifest/.test(m.text()) && !/\/api\/ping|manifest/.test(url)) { errors++; log(`[${name}] console.error: ${m.text()} (${url})`); } });
  page.on('dialog', d => d.accept());
  if (storage) await ctx.addInitScript((st) => { localStorage.setItem('nrd.v1', JSON.stringify(st)); }, storage);
  return { ctx, page };
}
const st = (page) => page.evaluate(() => { const a = window.__app; const s = a.state; return s ? { phase: s.phase, round: s.round, gold: Math.floor(s.gold), units: s.units.length, monsters: s.monsters.length, kills: s.stats.kills, screen: a.screen, mode: a.mode, viewPid: a.viewPid, selected: a.selected, fps: a.fps } : { screen: a.screen }; });
const slotPx = (page, slot) => page.evaluate((slot) => { const r = window.__app.renderer; const c = slot % 4, row = Math.floor(slot / 4); const x = (1.5 + c) * 50, y = (1.5 + row) * 50; const rect = r.canvas.getBoundingClientRect(); return { x: rect.left + r.ox + x * r.scale, y: rect.top + r.oy + y * r.scale }; }, slot);
const tapSlot = async (page, slot) => { const p = await slotPx(page, slot); await page.touchscreen.tap(p.x, p.y); await sleep(120); };

// ---------- A. 솔로 ----------
async function solo(name, viewport) {
  const { ctx, page } = await newPage(name, viewport);
  await page.goto(`http://127.0.0.1:${STATIC_PORT}/`); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.fill('#title input.text', '테스터');
  await page.tap('text=혼자 하기'); await page.waitForSelector('#cv'); await sleep(300);
  await page.screenshot({ path: `e2e-out/${name}-02-start.png` });
  for (let i = 0; i < 5; i++) { await page.tap('#btn-summon'); await sleep(80); }
  let s = await st(page); log(`${name}: 5 summons → gold=${s.gold} units=${s.units} phase=${s.phase}`);
  // 유닛 탭 → 패널
  const slot0 = await page.evaluate(() => window.__app.state.units[0].slot);
  await tapSlot(page, slot0);
  const panel = await page.evaluate(() => !document.getElementById('unitpanel').classList.contains('hidden'));
  log(`${name}: unit panel visible=${panel} selected=${(await st(page)).selected}`);
  await page.screenshot({ path: `e2e-out/${name}-03-selected.png` });
  // 이동: 이동 버튼 → 빈 자리
  await page.tap('text=이동'); await sleep(100);
  const empty = await page.evaluate(() => window.__app.state.slots.findIndex(x => x == null));
  await tapSlot(page, empty);
  const moved = await page.evaluate((e) => window.__app.state.units.some(u => u.slot === e), empty);
  log(`${name}: moved to slot ${empty} = ${moved}`);
  // 드래그: 유닛을 다른 빈 자리로
  const u1 = await page.evaluate(() => window.__app.state.units[1].slot);
  const empty2 = await page.evaluate(() => window.__app.state.slots.findIndex((x, i) => x == null && i > 7));
  const a = await slotPx(page, u1), b = await slotPx(page, empty2);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 20, a.y + 10, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await sleep(150);
  const dragged = await page.evaluate((e) => window.__app.state.units.some(u => u.slot === e), empty2);
  log(`${name}: dragged to slot ${empty2} = ${dragged}`);
  // 2배속으로 전투 진행 + 봇처럼 소환/합성
  await page.tap('#btn-speed');
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const r = await page.evaluate(() => { const a = window.__app; const s = a.state; if (!s) return null; if (s.gold >= 20 && s.slots.some(x => x == null)) a.act({ type: 'summon' }); a.act({ type: 'automerge' }); return { round: s.round, monsters: s.monsters.length, kills: s.stats.kills, phase: s.phase }; });
    if (!r || r.phase === 'eliminated' || r.phase === 'won') break; await sleep(500);
  }
  s = await st(page); log(`${name}: after 25s@2x round=${s.round} monsters=${s.monsters} kills=${s.kills} units=${s.units} fps=${s.fps.toFixed(0)}`);
  await page.screenshot({ path: `e2e-out/${name}-04-combat.png` });
  // 시트
  for (const [btn, id] of [['#btn-craft', 'craft'], ['#btn-upgrade', 'upgrade']]) {
    await page.tap(btn); await sleep(200); const open = await page.evaluate(() => !!document.getElementById('sheet'));
    await page.screenshot({ path: `e2e-out/${name}-05-${id}.png` });
    await page.tap('#sheet .close'); await sleep(100); const closed = await page.evaluate(() => !document.getElementById('sheet'));
    log(`${name}: sheet ${id} open=${open} closed=${closed}`);
  }
  // 강화 구매
  await page.evaluate(() => { window.__app.state.gold += 500; }); await page.tap('#btn-upgrade'); await sleep(200); await page.tap('text=업그레이드'); await sleep(100);
  const lv = await page.evaluate(() => window.__app.state.summonLv); log(`${name}: summon lv after upgrade=${lv}`); await page.tap('#sheet .close');
  // 일시정지
  await page.tap('#btn-pause'); await sleep(200); const t1 = await page.evaluate(() => window.__app.state.time); await sleep(600); const t2 = await page.evaluate(() => window.__app.state.time);
  log(`${name}: paused frozen=${t1 === t2}`); await page.screenshot({ path: `e2e-out/${name}-06-pause.png` }); await page.tap('text=계속하기'); await sleep(100);
  // 탈락 강제 → 결과 화면
  await page.evaluate(() => { const s = window.__app.state; for (let i = 0; i < 85; i++) s.monsters.push({ id: 90000 + i, type: 'grunt', boss: false, round: s.round, hp: 1e9, maxHp: 1e9, dist: i * 10, laps: 0, speed: 50, x: 25, y: 25, slowAmt: 0, slowT: 0, stunT: 0, stunImmT: 0, auraSlow: 0, alive: true }); });
  await page.waitForSelector('#result', { timeout: 8000 });
  s = await st(page); log(`${name}: result screen phase=${s.phase}`);
  await page.screenshot({ path: `e2e-out/${name}-07-result.png` });
  await page.tap('text=처음으로'); await page.waitForSelector('#title');
  await ctx.close();
}

// ---------- B. 협동 (WS 또는 P2P) ----------
async function coop(kind) {
  const url = kind === 'ws' ? `http://127.0.0.1:${WS_PORT}/` : `http://127.0.0.1:${STATIC_PORT}/`;
  const storage = (name) => ({ settings: { name, sound: false, volume: 0, serverUrl: '', peerHost: kind === 'p2p' ? `http://127.0.0.1:${PEER_PORT}/peer` : '', lowFx: false, token: name + '-tok-' + Math.random().toString(36).slice(2), lastRoom: '' }, records: {} });
  const A = await newPage(`${kind}-host`, { width: 390, height: 844 }, storage('방장'));
  const B = await newPage(`${kind}-guest`, { width: 360, height: 780 }, storage('친구'));
  await A.page.goto(url); await A.page.waitForSelector('#title');
  await A.page.tap('text=방 만들기'); await A.page.waitForSelector('.code', { timeout: 20000 });
  const code = await A.page.textContent('.code'); log(`${kind}: room code=${code} netKind=${await A.page.evaluate(() => window.__app.netKind)}`);
  await A.page.screenshot({ path: `e2e-out/${kind}-01-lobby-host.png` });
  await B.page.goto(url + `?room=${code}`); await B.page.waitForSelector('#title');
  await B.page.tap('text=참가'); await B.page.waitForSelector('.players', { timeout: 20000 }); await sleep(400);
  const names = await A.page.$$eval('.players .card b', els => els.map(e => e.textContent));
  log(`${kind}: host lobby players=${JSON.stringify(names)}`);
  await B.page.screenshot({ path: `e2e-out/${kind}-02-lobby-guest.png` });
  await A.page.tap('text=게임 시작');
  await A.page.waitForSelector('#cv', { timeout: 10000 }); await B.page.waitForSelector('#cv', { timeout: 10000 });
  log(`${kind}: both in game; host mode=${(await st(A.page)).mode} guest mode=${(await st(B.page)).mode}`);
  await sleep(4500); // 카운트다운 3초 → 라운드 1
  for (const p of [A.page, B.page]) for (let i = 0; i < 5; i++) { await p.tap('#btn-summon'); await sleep(60); }
  let sa = await st(A.page), sb = await st(B.page);
  log(`${kind}: after round start host round=${sa.round} guest round=${sb.round} host units=${sa.units} guest units=${sb.units}`);
  // 탭에 상대 표시?
  await sleep(1500);
  const tabsA = await A.page.$$eval('#tabs .tab', els => els.map(e => e.textContent));
  log(`${kind}: host tabs=${JSON.stringify(tabsA)}`);
  // 골드 보내기 (호스트 → 게스트)
  await A.page.evaluate(() => { window.__app.state.gold += 200; });
  const gb0 = (await st(B.page)).gold;
  await A.page.tap('#btn-team'); await sleep(300); await A.page.screenshot({ path: `e2e-out/${kind}-03-team.png` });
  await A.page.tap('button:has-text("100G")'); await sleep(600);
  const gb1 = (await st(B.page)).gold; log(`${kind}: guest gold ${gb0} → ${gb1} (expect +100)`);
  await A.page.tap('#sheet .close').catch(() => {});
  // 이모티콘 (게스트 → 모두)
  await B.page.tap('#btn-team'); await sleep(200); await B.page.tap('text=나이스!'); await sleep(500);
  const toastA = await A.page.$$eval('#toasts .toast', els => els.map(e => e.textContent)); log(`${kind}: host toasts=${JSON.stringify(toastA)}`);
  // 관전: 게스트가 호스트 판 보기
  const tabsB = await B.page.$$('#tabs .tab'); if (tabsB[1]) await tabsB[1].tap(); await sleep(900);
  sb = await st(B.page); const remoteView = await B.page.evaluate(() => { const a = window.__app; const p = a.peers.get(a.viewPid); return p && p.board ? { units: p.board.u.length, monsters: p.board.m.length, r: p.board.r } : null; });
  log(`${kind}: guest viewPid=${sb.viewPid} remote board=${JSON.stringify(remoteView)}`);
  await B.page.screenshot({ path: `e2e-out/${kind}-04-spectate.png` });
  await A.page.screenshot({ path: `e2e-out/${kind}-04-host-game.png` });
  if (tabsB[0]) await (await B.page.$$('#tabs .tab'))[0].tap();
  // 라운드 동기화 확인: 30초 대기 → 두 클라이언트 라운드 동일
  await sleep(26000);
  sa = await st(A.page); sb = await st(B.page);
  log(`${kind}: after 30s host round=${sa.round} guest round=${sb.round} monsters ${sa.monsters}/${sb.monsters} kills ${sa.kills}/${sb.kills} fps ${sa.fps.toFixed(0)}/${sb.fps.toFixed(0)}`);
  // 게스트 탈락 강제 → 호스트 탭에 탈락 표시 → 게스트 관전 오버레이
  await B.page.evaluate(() => { const s = window.__app.state; for (let i = 0; i < 85; i++) s.monsters.push({ id: 90000 + i, type: 'grunt', boss: false, round: s.round, hp: 1e9, maxHp: 1e9, dist: i * 10, laps: 0, speed: 50, x: 25, y: 25, slowAmt: 0, slowT: 0, stunT: 0, stunImmT: 0, auraSlow: 0, alive: true }); });
  await sleep(1500);
  const tabsA2 = await A.page.$$eval('#tabs .tab', els => els.map(e => e.textContent)); const ovB = await B.page.evaluate(() => document.getElementById('overlay').textContent);
  log(`${kind}: after guest eliminated host tabs=${JSON.stringify(tabsA2)} guest overlay="${ovB.slice(0, 40)}"`);
  await B.page.screenshot({ path: `e2e-out/${kind}-05-eliminated.png` });
  // 호스트도 탈락 → 모두 탈락 → 종료 → 결과 화면(팀 표)
  await A.page.evaluate(() => { const s = window.__app.state; for (let i = 0; i < 85; i++) s.monsters.push({ id: 91000 + i, type: 'grunt', boss: false, round: s.round, hp: 1e9, maxHp: 1e9, dist: i * 10, laps: 0, speed: 50, x: 25, y: 25, slowAmt: 0, slowT: 0, stunT: 0, stunImmT: 0, auraSlow: 0, alive: true }); });
  await A.page.waitForSelector('#result', { timeout: 8000 }); await B.page.waitForSelector('#result', { timeout: 8000 });
  const rows = await A.page.$$eval('.tbl tr', trs => trs.map(t => t.textContent)); log(`${kind}: result table=${JSON.stringify(rows)}`);
  await A.page.screenshot({ path: `e2e-out/${kind}-06-result-host.png` });
  // 다시 → 로비
  await A.page.tap('text=같은 방에서 다시'); await A.page.waitForSelector('.code', { timeout: 5000 }); await B.page.waitForSelector('.code', { timeout: 5000 });
  log(`${kind}: back to lobby both=${!!(await A.page.$('.code')) && !!(await B.page.$('.code'))}`);
  // 같은 방에서 두 번째 게임 시작
  await A.page.tap('text=게임 시작'); await A.page.waitForSelector('#cv', { timeout: 10000 }); await B.page.waitForSelector('#cv', { timeout: 10000 }); await sleep(4500);
  sa = await st(A.page); sb = await st(B.page); log(`${kind}: second game host round=${sa.round} phase=${sa.phase} guest round=${sb.round} phase=${sb.phase}`);
  await A.page.tap('.hud .icon:last-child'); await sleep(200); await A.page.tap('text=게임 나가기'); await A.page.waitForSelector('#title', { timeout: 5000 }); await sleep(800);
  const ovB2 = await B.page.evaluate(() => document.getElementById('overlay') ? document.getElementById('overlay').textContent : '(no overlay)'); log(`${kind}: after host left guest sees="${ovB2.slice(0, 30)}"`);
  await B.page.tap('text=나가기').catch(() => {}); await sleep(300);
  await A.ctx.close(); await B.ctx.close(); return;
  await B.page.tap('text=나가기'); await sleep(500);
  const namesAfter = await A.page.$$eval('.players .card b', els => els.map(e => e.textContent)); log(`${kind}: after guest leave host lobby=${JSON.stringify(namesAfter)}`);
  await A.ctx.close(); await B.ctx.close();
}

try {
  const only = process.env.E2E_ONLY;
  if (!only || only === 'solo') { await solo('solo-390x844', { width: 390, height: 844 }); await solo('solo-land', { width: 844, height: 390 }); }
  if (!only || only === 'ws') await coop('ws');
  if (!only || only === 'p2p') await coop('p2p');
} catch (e) { errors++; log('FATAL: ' + (e.stack || e)); }
await browser.close(); await game.close(); stat.close(); peerSrv.close?.();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errors ? `FAILED with ${errors} errors` : 'E2E OK');
process.exit(errors ? 1 : 0);
