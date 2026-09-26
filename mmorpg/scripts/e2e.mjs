// Real-browser test (headless Chromium, touch emulation). Offline flow on 3 phone viewports — two landscape (WebGL high and
// the Canvas2D fallback) and one portrait phone, where the game rotates itself into landscape — + 2-player online session.
// Needs a build first (npm run build). Screenshots → e2e-out/, log → e2e-out/report.txt
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const report = []; const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
/** Web fonts come from Google Fonts; an unreachable font server is not an app error. */
const watch = (page, errors) => {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push('request failed: ' + r.url()); });
};
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
/** Tap until the UI reacts. Under software WebGL a frame can take ~0.4 s and Chromium then reads a tap as a long-press,
 *  so a lost tap is retried; a control that never responds still fails. */
const tapUntil = async (page, sel, cond, tries = 3) => {
  for (let i = 0; i < tries; i++) { await page.tap(sel); for (let k = 0; k < 15; k++) { await page.waitForTimeout(100); if (await page.evaluate(cond)) return true; } }
  return false;
};
const state = (page) => page.evaluate(() => { const g = window.__app.g; if (!g?.ready) return null; return { lvl: g.me.level, xp: g.me.xp, hp: g.me.hp, zone: g.me.zone, kills: g.me.lstats.kills, quest: g.me.quest.main, auto: g.me.auto, players: g.players.size, mons: g.mons.size, fps: Math.round(g.fps), roster: g.roster.size, humans: [...g.roster.values()].filter(r => !r.bot).length, pos: g.myPos() }; });

/** Locked classes, the unlock card and a class change through the 직업 sheet, driven through the in-page offline server. */
async function classFlow(page, name) {
  await page.evaluate(() => { window.__pilotOff = true; window.__app.joy.x = 0; window.__app.joy.y = 0; });
  const srv = () => page.evaluate(() => { const w = window.__app.tr.gs.worlds[0]; return { w: !!w, p: !!w?.players.get(window.__app.g.myId) }; });
  const ok = await srv(); if (!ok.p) { check(false, 'in-page server player found'); return; }
  const back = await page.evaluate(() => { const w = window.__app.tr.gs.worlds[0]; const p = w.players.get(window.__app.g.myId); const at = { x: p.x, y: p.y };
    w.teleport(p, w.map.spawn.x, w.map.spawn.y + 60); p.prof.level = Math.max(p.prof.level, 8); w.recompute(p); p.questVer++; w.emitTo(p, { k: 'unlock', c: 'spear' }); return at; });
  let card = false; for (let i = 0; i < 20 && !card; i++) { await page.waitForTimeout(100); card = await page.evaluate(() => !!document.querySelector('.bosscard.unlock.show')); }
  await page.waitForFunction(() => window.__app.g.me.zone === 0 && window.__app.g.me.level >= 8, null, { timeout: 5000 }).catch(() => null);
  const badge = await page.evaluate(() => document.querySelector('.tr .menu button[data-k="settings"]').classList.contains('badge'));
  check(card && badge, `new-class unlock shows a card and a menu badge (card ${card}, badge ${badge})`);
  await page.screenshot({ path: `e2e-out/${name}-07-unlock.png` });
  await tapUntil(page, '.tr .menu button[data-k="settings"]', () => !!document.querySelector('#sheet:not(.hidden) .clsbtn'));
  await tapUntil(page, '#sheet .clsbtn', () => document.querySelectorAll('.clsrow').length > 0);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.clsrow')].map(r => ({ id: r.dataset.cls, locked: r.textContent.includes('🔒') })));
  check(rows.length === 10 && rows.filter(r => r.locked).length === 6, `직업 sheet lists 10 classes, 6 still locked at Lv8 (${rows.filter(r => r.locked).map(r => r.id).join(',')})`);
  await tapUntil(page, '.clsrow[data-cls="spear"]', () => !!document.querySelector('.cls-go:not([disabled])'));
  await page.screenshot({ path: `e2e-out/${name}-08-cls.png` });
  await tapUntil(page, '.cls-go', () => window.__app.g.me.cls === 'spear');
  const st = await page.evaluate(() => ({ cls: window.__app.g.me.cls, glyph: window.__app.el.ultGlyph.textContent, roster: window.__app.g.roster.get(window.__app.g.myId)?.cls }));
  check(st.cls === 'spear' && st.glyph === '槍' && st.roster === 'spear', `class change to 창술사 in town (me ${st.cls}, ult ${st.glyph}, roster ${st.roster})`);
  await tapUntil(page, '#sheet .close', () => document.getElementById('sheet').classList.contains('hidden'));
  // fight as the new class
  const k0 = (await state(page)).kills;
  await page.evaluate((at) => { const w = window.__app.tr.gs.worlds[0]; const p = w.players.get(window.__app.g.myId); w.teleport(p, at.x, at.y); window.__pilotOff = false; }, back);
  await page.waitForTimeout(9000);
  const s = await state(page); check(s.kills > k0, `the new class fights (+${s.kills - k0} kills in 9 s)`);
  await page.screenshot({ path: `e2e-out/${name}-09-spear.png` });
}

async function offline(name, viewport, quality, classes = false) {
  log(`\n[offline] ${name} ${viewport.width}x${viewport.height}, graphics ${quality}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = []; watch(page, errors);
  await page.goto('file://' + resolve('play/index.html')); await page.waitForSelector('#title');
  // Pick the graphics level like a player would (saved setting + reload). Not via addInitScript: a localStorage write at
  // document creation during page.reload() intermittently wiped the whole origin's storage in headless Chromium
  // (5 of 20 reloads with the init script, 0 of 11 without), which looked like a lost save.
  await page.evaluate((q) => localStorage.setItem('moonlit.settings', JSON.stringify({ quality: q })), quality);
  await page.reload(); await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  const rot = await page.evaluate(() => document.documentElement.classList.contains('rot'));
  check(rot === viewport.height > viewport.width, `layout is landscape${rot ? ' (portrait screen: rotated 90°)' : ''}`);
  await page.tap('text=모험 시작'); await page.waitForSelector('#create');
  const cc = await page.evaluate(() => [...document.querySelectorAll('.classcard')].map(c => c.textContent.includes('🔒')));
  check(cc.length === 10 && cc.filter(Boolean).length === 8 && !cc[0] && !cc[1], `create screen: 10 classes, only 검객·궁사 selectable (${cc.filter(Boolean).length} locked)`);
  await page.tap('.classcard >> nth=1'); await page.fill('#create input', '이투이');
  await page.screenshot({ path: `e2e-out/${name}-02-create.png` });
  await page.tap('text=퇴마 시작!'); await page.waitForFunction(() => window.__app?.g?.ready, null, { timeout: 8000 });
  await page.waitForTimeout(800);
  let s = await state(page); check(s && s.lvl === 1 && s.zone === 0 && s.roster === 7, `entered town as Lv1 with 6 AI companions (roster ${s?.roster})`);
  await page.screenshot({ path: `e2e-out/${name}-03-town.png` });
  const ri = await page.evaluate(() => window.__app.g.r.info());
  check(ri.painter === (quality === 'low' ? '2d' : 'gl') && ri.draws > 0 && ri.quads > 50, `renderer: ${ri.painter === 'gl' ? 'WebGL' : 'Canvas2D'} (${quality}), ${ri.quads} sprites in ${ri.draws} draw calls, art scale ${ri.art}`);
  // real touch drag on the play area moves the character
  const p0 = s.pos; const box = await page.locator('#touch').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  const cdp = await ctx.newCDPSession(page);
  // content-right is screen-right, or screen-down when the layout is rotated
  const [ux, uy] = rot ? [0, 1] : [1, 0];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + ux * i * 6, y: cy + uy * i * 6 }] }); await page.waitForTimeout(40); }
  await page.waitForTimeout(900); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  s = await state(page); check(s.pos.x > p0.x + 30 && Math.abs(s.pos.y - p0.y) < 30, `touch-drag joystick moved the player right on screen (+${Math.round(s.pos.x - p0.x)}px, Δy ${Math.round(s.pos.y - p0.y)})`);
  // hunt with an autopilot for 30 s
  await page.evaluate(AUTOPILOT); await page.evaluate(() => { window.__fx = { parts: 0, combo: 0, waves: 0 }; setInterval(() => { const g = window.__app.g; const f = window.__fx; f.parts = Math.max(f.parts, g.fx.parts.length); f.combo = Math.max(f.combo, g.combo); f.waves = Math.max(f.waves, g.fx.waves.length); }, 100); });
  await page.waitForTimeout(30000);
  s = await state(page); check(s.kills > 20 && s.lvl >= 2, `hunting works: Lv${s.lvl}, ${s.kills} kills, quest ${s.quest}, ${s.mons} monsters in view, ${s.fps} fps`);
  const fxs = await page.evaluate(() => window.__fx); check(fxs.parts > 40 && fxs.combo >= 5, `combat effects: up to ${fxs.parts} particles, combo ${fxs.combo}, ${fxs.waves} shockwaves at once`);
  await page.screenshot({ path: `e2e-out/${name}-04-hunt.png` });
  // every sheet opens and closes
  for (const k of ['bag', 'tal', 'quest', 'map', 'settings']) {
    const open = await tapUntil(page, `.tr .menu button[data-k="${k}"]`, () => !document.getElementById('sheet').classList.contains('hidden'));
    if (k === 'bag' || k === 'map' || k === 'tal') await page.screenshot({ path: `e2e-out/${name}-05-${k}.png` });
    const closed = await tapUntil(page, '#sheet .close', () => document.getElementById('sheet').classList.contains('hidden'));
    check(open && closed, `sheet ${k} opens/closes`);
  }
  // chat bubble round-trip
  await tapUntil(page, '.chatbtn >> nth=0', () => !!document.querySelector('#sheet:not(.hidden) input')); await page.fill('#sheet input', '안녕하세요!'); await page.press('#sheet input', 'Enter');
  let chatOk = false; for (let i = 0; i < 40 && !chatOk; i++) { await page.waitForTimeout(100); chatOk = await page.evaluate(() => window.__app.chatLines().some(l => l.text === '안녕하세요!')); }
  if (!chatOk) { await page.screenshot({ path: `e2e-out/${name}-chat-fail.png` }); log('    chat debug: ' + JSON.stringify(await page.evaluate(() => ({ sheet: window.__app.sheet?.name ?? null, lines: window.__app.chatLines().slice(-4).map(l => l.text), active: document.activeElement?.tagName })))); }
  check(chatOk, 'chat message comes back from the server into the chat log');
  // AUTO hunt: server-side AI takes over, joystick cancels it
  await page.evaluate(() => { window.__pilotOff = true; window.__app.joy.x = 0; window.__app.joy.y = 0; });
  await tapUntil(page, '.autobtn', () => !!window.__app.g.me.auto); const a0 = await state(page);
  let path = 0, wasDown = false, prev = a0.pos;
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); const a = await state(page); path += Math.hypot(a.pos.x - prev.x, a.pos.y - prev.y); prev = a.pos; if (a.hp <= 0) wasDown = true; }
  check(a0.auto && (path > 60 || wasDown), `AUTO mode drives the character (walked ${Math.round(path)}px in 8s${wasDown ? ', was knocked down meanwhile' : ''})`);
  await page.screenshot({ path: `e2e-out/${name}-06-auto.png` });
  await page.evaluate(() => { window.__app.joy.x = 1; }); await page.waitForTimeout(700); await page.evaluate(() => { window.__app.joy.x = 0; });
  check(!(await state(page)).auto, 'touching the joystick turns AUTO off');
  if (classes) await classFlow(page, name);
  // save & resume
  const before = await state(page);
  await page.evaluate(() => window.__app.tr.saveNow());
  await page.reload(); await page.waitForSelector('#title');
  const cont = await page.waitForSelector('text=이어하기', { timeout: 4000 }).catch(() => null);
  if (!cont) { await page.screenshot({ path: `e2e-out/${name}-resume-fail.png` }); log('    resume debug: ' + JSON.stringify(await page.evaluate(() => ({ keys: Object.keys(localStorage), char: localStorage.getItem('moonlit.char.offline'), title: document.querySelector('#title .menu')?.textContent })))); }
  check(!!cont, 'title offers 이어하기 after reload');
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
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errors = []; watch(page, errors);
    await page.goto(`http://127.0.0.1:${port}/`); await page.waitForSelector('.online-box button', { timeout: 6000 });
    await page.tap('.online-box button'); await page.waitForSelector('#create'); await page.tap(`.classcard >> nth=${i}`); await page.fill('#create input', nm); await page.tap('text=퇴마 시작!');
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
if (!only || only === 'land') await offline('landscape-844x390', { width: 844, height: 390 }, 'high', true);
if (!only || only === 'small') await offline('small-667x375', { width: 667, height: 375 }, 'low');
if (!only || only === 'rot') await offline('portrait-390x844', { width: 390, height: 844 }, 'mid');
if (!only || only === 'online') await online();
await browser.close();
log(failures ? `\nE2E FAILED (${failures})` : '\nE2E OK'); writeFileSync('e2e-out/report.txt', report.join('\n'));
process.exit(failures ? 1 : 0);
