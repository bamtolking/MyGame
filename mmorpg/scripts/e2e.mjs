// Real-browser test (headless Chromium, touch emulation). Offline flow on 3 phone viewports + 2-player online session.
// Needs a build first (npm run build). Screenshots → e2e-out/, log → e2e-out/report.txt
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const report = []; const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0; const check = (ok, msg) => { if (!ok) { failures++; log('  ✗ ' + msg); } else log('  ✓ ' + msg); };

const AUTOPILOT = () => {
  const app = window.__app; let orbit = 1;
  window.__pilot = setInterval(() => {
    const g = app.g; if (!g?.ready || window.__pilotOff) return; const me = g.myPos();
    let best = null, bd = 1e9; for (const m of g.mons.values()) { const d = Math.hypot(m.x - me.x, m.y - me.y); if (d < bd) { bd = d; best = m; } }
    let x, y; const L = g.map.lairs[0]; const tx = L.x - 200, ty = L.y - 260;
    if (g.me.zone === 0 || !best || bd > 420) { const a = g.me.zone === 0 && app.questPath.ang != null ? app.questPath.ang : Math.atan2(ty - me.y, tx - me.x); x = Math.cos(a); y = Math.sin(a); if (g.me.zone !== 0 && best) { x = (best.x - me.x) / bd; y = (best.y - me.y) / bd; } }
    else { const ux = (best.x - me.x) / bd, uy = (best.y - me.y) / bd; const r = bd > 220 ? 1 : bd < 140 ? -1 : 0; x = ux * r - uy * orbit * 0.8; y = uy * r + ux * orbit * 0.8; if (Math.random() < 0.01) orbit *= -1; }
    const l = Math.hypot(x, y) || 1; app.joy.x = x / l; app.joy.y = y / l;
    if (g.me.ult >= 100 && g.me.zone !== 0) g.send({ t: 'ult' });
  }, 120);
};
const state = (page) => page.evaluate(() => { const g = window.__app.g; if (!g?.ready) return null; return { lvl: g.me.level, xp: g.me.xp, hp: g.me.hp, zone: g.me.zone, kills: g.me.lstats.kills, quest: g.me.quest.main, auto: g.me.auto, players: g.players.size, mons: g.mons.size, fps: Math.round(g.fps), roster: g.roster.size, humans: [...g.roster.values()].filter(r => !r.bot).length, pos: g.myPos() }; });

async function offline(name, viewport) {
  log(`\n[offline] ${name} ${viewport.width}x${viewport.height}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + resolve('play/index.html')); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.tap('text=모험 시작'); await page.waitForSelector('#create');
  await page.tap('.classcard >> nth=1'); await page.fill('#create input', '이투이');
  await page.screenshot({ path: `e2e-out/${name}-02-create.png` });
  await page.tap('text=퇴마 시작!'); await page.waitForFunction(() => window.__app?.g?.ready, null, { timeout: 8000 });
  await page.waitForTimeout(800);
  let s = await state(page); check(s && s.lvl === 1 && s.zone === 0 && s.roster === 7, `entered town as Lv1 with 6 AI companions (roster ${s?.roster})`);
  await page.screenshot({ path: `e2e-out/${name}-03-town.png` });
  // real touch drag on the play area moves the character
  const p0 = s.pos; const box = await page.locator('#touch').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 6, y: cy }] }); await page.waitForTimeout(40); }
  await page.waitForTimeout(900); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  s = await state(page); check(s.pos.x > p0.x + 30, `touch-drag joystick moved the player (+${Math.round(s.pos.x - p0.x)}px)`);
  // hunt with an autopilot for 30 s
  await page.evaluate(AUTOPILOT); await page.waitForTimeout(30000);
  s = await state(page); check(s.kills > 20 && s.lvl >= 2, `hunting works: Lv${s.lvl}, ${s.kills} kills, quest ${s.quest}, ${s.mons} monsters in view, ${s.fps} fps`);
  await page.screenshot({ path: `e2e-out/${name}-04-hunt.png` });
  // every sheet opens and closes
  for (const k of ['bag', 'tal', 'quest', 'map', 'settings']) {
    await page.tap(`.tr .menu button[data-k="${k}"]`); await page.waitForTimeout(250);
    const open = await page.evaluate(() => !document.getElementById('sheet').classList.contains('hidden'));
    if (k === 'bag' || k === 'map' || k === 'tal') await page.screenshot({ path: `e2e-out/${name}-05-${k}.png` });
    await page.tap('#sheet .close'); await page.waitForTimeout(150);
    const closed = await page.evaluate(() => document.getElementById('sheet').classList.contains('hidden'));
    check(open && closed, `sheet ${k} opens/closes`);
  }
  // chat bubble round-trip
  await page.tap('.chatbtn >> nth=0'); await page.fill('#sheet input', '안녕하세요!'); await page.tap('#sheet button.primary');
  let chatOk = false; for (let i = 0; i < 20 && !chatOk; i++) { await page.waitForTimeout(100); chatOk = await page.evaluate(() => window.__app.chatLines().some(l => l.text === '안녕하세요!')); }
  check(chatOk, 'chat message comes back from the server into the chat log');
  // AUTO hunt: server-side AI takes over, joystick cancels it
  await page.evaluate(() => { window.__pilotOff = true; window.__app.joy.x = 0; window.__app.joy.y = 0; });
  await page.tap('.autobtn'); await page.waitForTimeout(500); const a0 = await state(page);
  let path = 0, wasDown = false, prev = a0.pos;
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); const a = await state(page); path += Math.hypot(a.pos.x - prev.x, a.pos.y - prev.y); prev = a.pos; if (a.hp <= 0) wasDown = true; }
  check(a0.auto && (path > 60 || wasDown), `AUTO mode drives the character (walked ${Math.round(path)}px in 8s${wasDown ? ', was knocked down meanwhile' : ''})`);
  await page.screenshot({ path: `e2e-out/${name}-06-auto.png` });
  await page.evaluate(() => { window.__app.joy.x = 1; }); await page.waitForTimeout(700); await page.evaluate(() => { window.__app.joy.x = 0; });
  check(!(await state(page)).auto, 'touching the joystick turns AUTO off');
  // save & resume
  const before = await state(page);
  await page.evaluate(() => window.__app.tr.saveNow());
  await page.reload(); await page.waitForSelector('#title');
  const cont = await page.$('text=이어하기'); check(!!cont, 'title offers 이어하기 after reload');
  if (cont) { await cont.tap(); await page.waitForFunction(() => window.__app?.g?.ready, null, { timeout: 8000 }); await page.waitForTimeout(500); const r = await state(page); check(r.lvl === before.lvl && r.kills >= before.kills - 5, `resumed Lv${r.lvl} (was Lv${before.lvl}), kills ${r.kills}`); }
  check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

async function online() {
  log('\n[online] two players through the real server');
  if (!existsSync('dist/index.html')) { log('  (skipped: no dist build)'); return; }
  const port = 18500 + Math.floor(Math.random() * 400);
  const srv = spawn(process.execPath, ['src/server/node/main.ts'], { env: { ...process.env, PORT: String(port), DATA_DIR: 'e2e-out/server-data', CHANNELS: '1' }, stdio: 'pipe' });
  await new Promise(res => srv.stdout.on('data', d => { if (String(d).includes('서버')) res(); }));
  const pages = [];
  for (const [i, nm] of [[0, '온라인하나'], [1, '온라인둘']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/`); await page.waitForSelector('.online-box button', { timeout: 6000 });
    await page.tap('.online-box button'); await page.waitForSelector('#create'); await page.tap(`.classcard >> nth=${i * 2}`); await page.fill('#create input', nm); await page.tap('text=퇴마 시작!');
    await page.waitForFunction(() => window.__app?.g?.ready, null, { timeout: 8000 }); pages.push({ page, errors, ctx });
  }
  await pages[0].page.waitForTimeout(1500);
  const [s0, s1] = [await state(pages[0].page), await state(pages[1].page)];
  check(s0.humans === 2 && s1.humans === 2 && s0.players >= 2 && s1.players >= 2, `both players see each other (humans ${s0.humans}/${s1.humans}, entities ${s0.players}/${s1.players})`);
  await pages[0].page.evaluate(() => window.__app.send({ t: 'chat', text: '온라인 인사!' })); await pages[1].page.waitForTimeout(800);
  check(await pages[1].page.evaluate(() => window.__app.chatLines().some(l => l.text === '온라인 인사!')), 'chat crosses between the two browsers');
  await pages[0].page.evaluate(AUTOPILOT); await pages[0].page.waitForTimeout(4000);
  const p1 = await pages[1].page.evaluate(() => { const g = window.__app.g; const other = [...g.players.values()].find(p => p.id !== g.myId); return other ? { x: other.x, y: other.y } : null; });
  const p0 = (await state(pages[0].page)).pos;
  check(p1 && Math.hypot(p1.x - p0.x, p1.y - p0.y) < 60, `player 2 sees player 1 where player 1 is (Δ ${p1 ? Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y)) : '?'}px, interpolation delay included)`);
  await pages[0].page.screenshot({ path: 'e2e-out/online-a.png' }); await pages[1].page.screenshot({ path: 'e2e-out/online-b.png' });
  for (const p of pages) check(p.errors.length === 0, `online client without errors${p.errors.length ? ': ' + p.errors.slice(0, 2).join(' | ') : ''}`);
  for (const p of pages) await p.ctx.close(); srv.kill('SIGTERM');
}

const only = process.env.E2E_ONLY;
if (!only || only === 'phone') await offline('phone-390x844', { width: 390, height: 844 });
if (!only || only === 'small') await offline('small-360x640', { width: 360, height: 640 });
if (!only || only === 'land') await offline('landscape-844x390', { width: 844, height: 390 });
if (!only || only === 'online') await online();
await browser.close();
log(failures ? `\nE2E FAILED (${failures})` : '\nE2E OK'); writeFileSync('e2e-out/report.txt', report.join('\n'));
process.exit(failures ? 1 : 0);
