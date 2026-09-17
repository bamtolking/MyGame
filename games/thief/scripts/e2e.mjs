// Real-browser run (headless Chromium, phone viewports, touch). Loads play/index.html, plays the core scene, screenshots to e2e-out/.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = []; const log = (m) => { console.log(m); report.push(m); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });

const SCRIPT_A = { weapon: 'rifle', steps: [{ to: [1, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [10, 1], dash: true }, { to: [6, 24], dash: true }] };
const SCRIPT_B = { weapon: 'rifle', steps: [{ to: [10, 13], dash: true }, { until: { laserOff: 'l1', max: 30 } }, { to: [10, 1], dash: true }, { until: { hasCore: true, max: 2 } }, { to: [6, 24], dash: true }] };

async function run(name, viewport, full) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(url); await page.waitForSelector('#screen-title.on');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#screen-title.on');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.tap('#missions button'); await page.waitForSelector('#screen-prep.on');
  await page.screenshot({ path: `e2e-out/${name}-02-prep-empty.png` });
  await page.tap('#btn-start'); await page.waitForSelector('#screen-play.on'); await page.waitForTimeout(300);
  // Real touch joystick: press bottom-left, drag up → the player must move up.
  const p0 = await page.evaluate(() => ({ x: window.__game.st.player.x, y: window.__game.st.player.y }));
  const jx = 90, jy = viewport.height - 160;
  await page.touchscreen.tap; // no-op reference
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - i * 6, id: 1 }] }); await page.waitForTimeout(40); }
  await page.waitForTimeout(700);
  const joy = await page.evaluate(() => ({ ...window.__game.input.joy }));
  await page.screenshot({ path: `e2e-out/${name}-03-joystick.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
  const p1 = await page.evaluate(() => ({ x: window.__game.st.player.x, y: window.__game.st.player.y, moving: window.__game.st.player.moving }));
  log(`${name}: joystick active=${joy.active} dy=${joy.dy.toFixed(2)} moved up=${(p0.y - p1.y).toFixed(0)}px, stopped after release=${!p1.moving}`);
  // dash button
  const dashBefore = await page.evaluate(() => window.__game.st.recording.dashes.length);
  await page.tap('#btn-dash'); await page.waitForTimeout(150);
  const dashAfter = await page.evaluate(() => window.__game.st.recording.dashes.length);
  log(`${name}: dash button recorded a dash=${dashAfter === dashBefore + 1}`);
  // pause: time must freeze
  await page.tap('#btn-pause'); await page.waitForTimeout(200);
  const t1 = await page.evaluate(() => window.__game.st.tick); await page.waitForTimeout(700); const t2 = await page.evaluate(() => window.__game.st.tick);
  await page.screenshot({ path: `e2e-out/${name}-04-pause.png` });
  log(`${name}: paused tick frozen=${t1 === t2}`);
  await page.tap('#btn-resume'); await page.waitForTimeout(300);
  const t3 = await page.evaluate(() => window.__game.st.tick);
  log(`${name}: resumed without a burst=${t3 - t2 <= 25}`);
  // restart the attempt from scratch and let the scripted bot play attempt A (solo: destroys generator, times out)
  await page.evaluate((s) => { const g = window.__game; g.startAttempt(); g.setAutopilot(s); }, SCRIPT_A);
  await page.waitForTimeout(6500); await page.screenshot({ path: `e2e-out/${name}-05-attemptA-fight.png` });
  await page.waitForFunction(() => window.__game.st && window.__game.st.outcome, null, { timeout: 40000 });
  const a = await page.evaluate(() => ({ outcome: window.__game.st.outcome.kind, gen: window.__game.st.generators[0].alive, laser: window.__game.st.lasers[0].phase, core: window.__game.st.player.hasCore, shots: window.__game.st.recording.shots.length }));
  log(`${name}: attempt A outcome=${a.outcome} generatorAlive=${a.gen} laser=${a.laser} hadCore=${a.core} shots=${a.shots}`);
  await page.waitForSelector('#end.on'); await page.waitForTimeout(200);
  await page.screenshot({ path: `e2e-out/${name}-06-endA.png` });
  // add the recording → attempt B with the ghost
  await page.evaluate(() => window.__game.setAutopilot(null));
  await page.tap('#end button[data-a=add]'); await page.waitForTimeout(200);
  await page.evaluate((s) => window.__game.setAutopilot(s), SCRIPT_B);
  await page.waitForTimeout(1200); await page.screenshot({ path: `e2e-out/${name}-07-attemptB-ghost-spawn.png` });
  await page.waitForTimeout(3800); await page.screenshot({ path: `e2e-out/${name}-08-attemptB-ghost-fights.png` });
  await page.waitForFunction(() => window.__game.st.generators[0].alive === false, null, { timeout: 20000 });
  await page.waitForTimeout(150); await page.screenshot({ path: `e2e-out/${name}-09-attemptB-laser-off.png` });
  await page.waitForFunction(() => window.__game.st.player.hasCore, null, { timeout: 20000 });
  await page.screenshot({ path: `e2e-out/${name}-10-attemptB-core.png` });
  await page.waitForFunction(() => window.__game.st.outcome, null, { timeout: 30000 });
  const b = await page.evaluate(() => ({ outcome: window.__game.st.outcome.kind, tick: window.__game.st.outcome.tick, by: window.__game.st.generators[0].destroyedBy, ghosts: window.__game.st.ghosts.length, ownShots: window.__game.st.recording.shots.length, fps: window.__game.fps }));
  log(`${name}: attempt B outcome=${b.outcome} at ${(b.tick / 60).toFixed(1)}s generatorDestroyedBy=${b.by} ghosts=${b.ghosts} ownShots=${b.ownShots} fps=${b.fps.toFixed(0)}`);
  await page.waitForSelector('#end.on'); await page.waitForTimeout(300);
  await page.screenshot({ path: `e2e-out/${name}-11-success.png` });
  // save persisted?
  await page.evaluate(() => window.__game.setAutopilot(null));
  await page.reload(); await page.waitForSelector('#screen-title.on');
  const saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('solo_heist_25s_v1')); return { slots: d.missions.m1.slots.filter((s) => s).length, clears: d.missions.m1.record.clears, best: d.missions.m1.record.bestTicks, unlocked: d.unlocked }; });
  log(`${name}: persisted slots=${saved.slots} clears=${saved.clears} best=${saved.best} unlocked=${saved.unlocked}`);
  await page.tap('#missions button'); await page.waitForSelector('#screen-prep.on'); await page.waitForTimeout(200);
  await page.screenshot({ path: `e2e-out/${name}-12-prep-with-ghost.png` });
  log(`${name}: errors=${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);
  await ctx.close(); return errors.length;
}
async function smoke(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url); await page.waitForSelector('#screen-title.on'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#screen-title.on');
  await page.screenshot({ path: `e2e-out/${name}-01-title.png` });
  await page.tap('#missions button'); await page.waitForSelector('#screen-prep.on'); await page.tap('#btn-start'); await page.waitForSelector('#screen-play.on'); await page.waitForTimeout(800);
  await page.screenshot({ path: `e2e-out/${name}-02-play.png` });
  log(`${name}: smoke ok errors=${errors.length}`); await ctx.close(); return errors.length;
}
let errs = 0; const only = process.env.E2E_ONLY;
if (!only || only === 'phone') errs += await run('phone-390x844', { width: 390, height: 844 }, true);
if (!only || only === 'small') errs += await run('small-360x800', { width: 360, height: 800 }, false);
if (!only || only === 'large') errs += await run('large-430x932', { width: 430, height: 932 }, false);
if (!only || only === 'land') errs += await smoke('landscape-844x390', { width: 844, height: 390 });
await browser.close();
writeFileSync('e2e-out/report.txt', report.join('\n'));
console.log(errs ? `FAILED with ${errs} errors` : 'E2E OK'); process.exit(errs ? 1 : 0);
