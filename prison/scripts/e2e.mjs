// Real-browser test (headless Chromium, mobile viewports). Loads play/index.html, plays, screenshots to e2e-out/.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = [];
const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#title');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForSelector('#title');
  await page.fill('#title input', '777');
  // --- empty plot: build a walled holding cell by dragging on the canvas ---
  await page.tap('text=새 게임 — 빈 부지');
  await page.waitForSelector('#cv');
  await page.waitForTimeout(300);
  const st0 = await page.evaluate(() => ({ mode: window.__app.state.mode, money: window.__app.state.money, staff: window.__app.state.staff.length, zoom: window.__app.renderer.cam.zoom }));
  log(`${name}: empty start mode=${st0.mode} money=${st0.money} staff=${st0.staff} zoom=${st0.zoom.toFixed(1)}`);
  await page.screenshot({ path: `e2e-out/${name}-02-empty.png` });
  // select wall tool
  await page.tap('#cats button:nth-child(2)'); await page.waitForTimeout(100);
  await page.tap('#chips button:nth-child(1)'); await page.waitForTimeout(100);
  const toolName = await page.evaluate(() => window.__app.tool.id);
  log(`${name}: tool=${toolName}`);
  const tileToScreen = async (tx, ty) => page.evaluate(([tx, ty]) => { const r = window.__app.renderer; const b = r.canvas.getBoundingClientRect(); return { x: b.left + r.sx(tx + 0.5), y: b.top + r.sy(ty + 0.5) }; }, [tx, ty]);
  const drag = async (x0, y0, x1, y1) => {
    const a = await tileToScreen(x0, y0), b = await tileToScreen(x1, y1);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    const steps = 8; for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }] }); await page.waitForTimeout(20); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await page.waitForTimeout(100);
  };
  // camera: center on (12,22) with a zoom so that a 9x7 box fits
  await page.evaluate(() => { const r = window.__app.renderer; r.cam.zoom = 18; r.centerOn(12, 22); });
  await drag(8, 19, 16, 25); // hollow 9x7 wall rectangle
  let st1 = await page.evaluate(() => ({ jobs: window.__app.state.jobs.length, money: window.__app.state.money }));
  log(`${name}: after wall drag jobs=${st1.jobs} money=${st1.money}`);
  await page.screenshot({ path: `e2e-out/${name}-03-walls-planned.png` });
  // door: select door tool (3rd chip) and tap a wall tile position (12,25) → but that tile is planned wall; cancel first via tap? Use demolish? Simpler: place a jail door at (8,22) after cancelling that job.
  await page.evaluate(() => window.__app.act({ type: 'cancel', x: 8, y: 22 }));
  await page.tap('#chips button:nth-child(4)'); await page.waitForTimeout(100); // 감옥문
  const d = await tileToScreen(8, 22); await page.touchscreen.tap(d.x, d.y); await page.waitForTimeout(150);
  st1 = await page.evaluate(() => ({ jobs: window.__app.state.jobs.length, tool: window.__app.tool.id }));
  log(`${name}: after jail door tap jobs=${st1.jobs} tool=${st1.tool}`);
  // zone: 구역 category → 대기실 (2nd chip: cell is 1st, holding 2nd)
  await page.tap('#cats button:nth-child(3)'); await page.waitForTimeout(100);
  await page.tap('#chips button:nth-child(2)'); await page.waitForTimeout(100);
  await drag(9, 20, 15, 24);
  // objects: toilet & benches
  await page.tap('#cats button:nth-child(4)'); await page.waitForTimeout(100);
  await page.tap('#chips button:nth-child(2)'); await page.waitForTimeout(100); // 변기
  const tl = await tileToScreen(15, 20); await page.touchscreen.tap(tl.x, tl.y); await page.waitForTimeout(100);
  await page.tap('#chips button:nth-child(3)'); await page.waitForTimeout(100); // 벤치
  await drag(9, 24, 12, 24);
  const st2 = await page.evaluate(() => ({ jobs: window.__app.state.jobs.length, objs: window.__app.state.objects.length, rooms: window.__app.state.cache.rooms.length, money: window.__app.state.money }));
  log(`${name}: planned jobs=${st2.jobs} objects=${st2.objs} rooms=${st2.rooms} money=${st2.money}`);
  await page.screenshot({ path: `e2e-out/${name}-04-planned.png` });
  // hire a guard via staff chips
  await page.tap('#cats button:nth-child(5)'); await page.waitForTimeout(100);
  await page.tap('#chips button:nth-child(1)'); await page.waitForTimeout(100);
  // 4x speed and wait for construction
  await page.evaluate(() => window.__app.setSpeed(4));
  await page.waitForTimeout(9000);
  const st3 = await page.evaluate(() => { const s = window.__app.state; const r = s.cache.rooms[0]; return { jobs: s.jobs.length, guards: s.staff.filter(x => x.type === 'guard').length, room: r ? { valid: r.valid, issues: r.issues, secure: r.secure, tiles: r.tiles.length } : null, chapter: s.chapter, fps: window.__app.fps }; });
  log(`${name}: after 9s@4x jobs=${st3.jobs} guards=${st3.guards} room=${JSON.stringify(st3.room)} chapter=${st3.chapter} fps=${st3.fps.toFixed(0)}`);
  await page.screenshot({ path: `e2e-out/${name}-05-built.png` });
  // tap the room → info card
  await page.tap('#cats button:nth-child(1)'); await page.waitForTimeout(100);
  const rc = await tileToScreen(12, 22); await page.touchscreen.tap(rc.x, rc.y); await page.waitForTimeout(200);
  const info = await page.evaluate(() => { const el = document.getElementById('infocard'); return el.classList.contains('hidden') ? null : el.textContent.slice(0, 120); });
  log(`${name}: infocard="${info}"`);
  await page.screenshot({ path: `e2e-out/${name}-06-info.png` });
  // sheets
  for (const [sel, nm] of [['objectives', '목표'], ['regime', '일과표'], ['staff', '직원'], ['intake', '수감'], ['report', '보고서'], ['settings', '설정'], ['help', '도움말']]) {
    await page.evaluate((n) => window.__app.openSheet(n), sel); await page.waitForTimeout(150);
    const open = await page.evaluate(() => !document.getElementById('sheet').classList.contains('hidden'));
    if (sel === 'objectives') await page.screenshot({ path: `e2e-out/${name}-07-objectives.png` });
    if (sel === 'regime') await page.screenshot({ path: `e2e-out/${name}-08-regime.png` });
    await page.tap('#sheet .close'); await page.waitForTimeout(100);
    const closed = await page.evaluate(() => document.getElementById('sheet').classList.contains('hidden'));
    log(`${name}: sheet ${nm} open=${open} closed=${closed}`);
  }
  // --- quick start: run a while and check for incidents/perf ---
  await page.evaluate(() => { window.__app.newRun(4242, 'quick'); });
  await page.waitForTimeout(300);
  await page.tap('#btn-speed'); await page.tap('#btn-speed');
  await page.waitForTimeout(15000);
  const st4 = await page.evaluate(() => { const s = window.__app.state; return { day: Math.floor(s.time / 15 / 24) + 1, prisoners: s.prisoners.length, money: Math.round(s.money), escapes: s.stats.escapes, fights: s.stats.fights, chapter: s.chapter, fps: window.__app.fps, save: window.__app.saveStatus, modal: window.__app.modalOpen }; });
  log(`${name}: quick after 15s@4x day=${st4.day} prisoners=${st4.prisoners} money=${st4.money} escapes=${st4.escapes} fights=${st4.fights} chapter=${st4.chapter} fps=${st4.fps.toFixed(0)} modal=${st4.modal} save="${st4.save}"`);
  if (st4.modal) { await page.screenshot({ path: `e2e-out/${name}-09-chapter-modal.png` }); await page.evaluate(() => window.__app.closeModal()); }
  await page.evaluate(() => { const r = window.__app.renderer; r.cam.zoom = 22; r.centerOn(18, 20); window.__app.renderer.showSecurity = true; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e-out/${name}-10-quick-security.png` });
  await page.evaluate(() => { window.__app.renderer.showSecurity = false; });
  // tap a prisoner
  const pp = await page.evaluate(() => { const p = window.__app.state.prisoners[0]; return p ? { x: p.x, y: p.y } : null; });
  if (pp) { await page.evaluate(({ x, y }) => window.__app.renderer.centerOn(x, y), pp); const sp = await tileToScreen(pp.x - 0.5, pp.y - 0.5); await page.touchscreen.tap(sp.x, sp.y); await page.waitForTimeout(200); const sel = await page.evaluate(() => JSON.stringify(window.__app.selection)); log(`${name}: tapped prisoner sel=${sel}`); await page.screenshot({ path: `e2e-out/${name}-11-prisoner.png` }); }
  // pause
  await page.tap('#btn-pause'); await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__app.state.time); await page.waitForTimeout(600); const t2 = await page.evaluate(() => window.__app.state.time);
  log(`${name}: paused time frozen=${t1 === t2}`);
  // reload → resume
  await page.reload(); await page.waitForSelector('#title');
  const resumeBtn = await page.$('text=이어하기');
  log(`${name}: resume button present=${!!resumeBtn}`);
  if (resumeBtn) { await resumeBtn.tap(); await page.waitForTimeout(500); const st5 = await page.evaluate(() => ({ day: Math.floor(window.__app.state.time / 15 / 24) + 1, prisoners: window.__app.state.prisoners.length, money: Math.round(window.__app.state.money) })); log(`${name}: resumed day=${st5.day} prisoners=${st5.prisoners} money=${st5.money}`); await page.screenshot({ path: `e2e-out/${name}-12-resumed.png` }); }
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close();
  return errors.length;
}
let errs = 0;
const only = process.env.E2E_ONLY;
if (!only || only === 'phone') errs += await run('phone-390x844', { width: 390, height: 844 });
if (!only || only === 'small') errs += await run('small-360x640', { width: 360, height: 640 });
if (!only || only === 'land') errs += await run('landscape-844x390', { width: 844, height: 390 });
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK');
process.exit(errs ? 1 : 0);
