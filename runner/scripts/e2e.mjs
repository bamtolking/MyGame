// Real-browser test: headless Chromium, mobile viewports, touch emulation. Loads play/index.html (the single file),
// walks every screen, plays runs with touch + keyboard, checks pause/results/retry, saving, and that there are
// no console errors and no network requests. Screenshots → e2e-out/, log → docs/e2e-report.txt.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = []; let failures = 0;
const log = m => { console.log(m); report.push(m); };
const check = (cond, msg) => { if (!cond) { failures++; log('  ✗ ' + msg); } else log('  ✓ ' + msg); };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function run(name, viewport) {
  log(`\n## ${name} ${viewport.width}×${viewport.height}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForSelector('.home');
  await page.screenshot({ path: `e2e-out/${name}-01-home.png` });
  const app = (fn, arg) => page.evaluate(fn, arg);

  // --- tutorial: first primary button starts it; play with taps on the jump zone / pads
  await page.tap('#btn-run');
  await page.waitForSelector('#cv');
  check(await app(() => window.__app.run?.s.mode) === 'tutorial', 'first run is the tutorial');
  await page.waitForTimeout(1700);
  const portrait = viewport.height > viewport.width;
  const jumpPoint = portrait ? await page.evaluate(() => { const r = document.querySelector('.pad.jump').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }) : { x: viewport.width * 0.2, y: viewport.height * 0.6 };
  const slidePoint = portrait ? await page.evaluate(() => { const r = document.querySelector('.pad.slide').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }) : { x: viewport.width * 0.8, y: viewport.height * 0.6 };
  const j0 = await app(() => window.__app.run.s.stats.jumps);
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(jumpPoint.x, jumpPoint.y); await page.waitForTimeout(260); }
  check(await app(() => window.__app.run.s.stats.jumps) > j0, 'touch on the jump zone jumps');
  // slide via a held touch (CDP touch events)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: slidePoint.x, y: slidePoint.y, id: 7 }] });
  await page.waitForTimeout(250);
  const sliding = await app(() => window.__app.run.s.body.sliding || window.__app.input.slideHeld);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(sliding, 'holding the slide zone slides');
  await page.screenshot({ path: `e2e-out/${name}-02-tutorial.png` });
  // keyboard also works
  const j1 = await app(() => window.__app.run.s.stats.jumps);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  check(await app(() => window.__app.run.s.stats.jumps) > j1, 'space key jumps');

  // --- pause / resume: time must stop
  await page.tap('#btn-pause'); await page.waitForTimeout(150);
  const t0 = await app(() => window.__app.run.s.steps); await page.waitForTimeout(500);
  check(await app(() => window.__app.run.s.steps) === t0, 'pause freezes the sim');
  await page.screenshot({ path: `e2e-out/${name}-03-pause.png` });
  await page.tap('text=계속 달리기'); await page.waitForTimeout(1400);
  check(await app(() => window.__app.run.s.steps) > t0, 'resume continues');

  // --- finish the tutorial quickly (teleport near the flag) → results → endless
  for (let i = 0; i < 40 && await app(() => window.__app.run.s.level.finishX === Infinity); i++) {
    await app(() => { const s = window.__app.run.s; s.body.x = s.level.genX - 80; s.body.y = 440; s.body.vy = 0; s.body.onGround = true; });
    await page.waitForTimeout(80);
  }
  await app(() => { const s = window.__app.run.s; s.body.x = s.level.finishX + 150; s.body.y = 440; s.body.vy = 0; s.body.onGround = true; });
  await page.waitForSelector('.results', { timeout: 8000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `e2e-out/${name}-04-tutorial-done.png` });
  check(await app(() => window.__app.p.tutorialDone) === true, 'tutorial completion is saved');
  await page.tap('#res-retry'); await page.waitForTimeout(400);
  check(await app(() => window.__app.run?.s.mode) === 'endless', 'results → endless run');

  // --- endless: play a while with an in-page autopilot (jump when a hazard is near), then die → results
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    window.__auto = setInterval(() => {
      const a = window.__app; const s = a.run?.s; if (!s || s.phase !== 'run') return;
      const b = s.body; const h = s.level.hazards.find(h => !h.passed && !h.broken && h.x0 > b.x && h.x0 < b.x + 140);
      if (h) { if (h.kind === 'hang') { a.input.keyDown('ArrowDown', false); } else if (b.onGround || h.kind === 'tall') { a.input.keyUp('ArrowDown'); a.input.pressJump(); } }
      else a.input.keyUp('ArrowDown');
      const pit = s.level.solids.every(o => !(o.ground && o.x0 <= b.x + 70 && o.x1 >= b.x + 70)); if (pit && b.onGround) a.input.pressJump();
    }, 50);
  });
  await page.waitForTimeout(9000);
  const mid = await app(() => { const s = window.__app.run.s; return { dist: Math.floor(s.dist), hp: Math.round(s.hp), hits: s.stats.hits, jellies: s.stats.jellies, fps: Math.round(window.__app.fps) }; });
  log(`  endless after 9 s: ${JSON.stringify(mid)}`);
  check(mid.dist > 60, 'the runner makes progress');
  check(mid.jellies > 10, 'jellies get collected');
  await page.screenshot({ path: `e2e-out/${name}-05-endless.png` });
  await page.evaluate(() => clearInterval(window.__auto));
  await app(() => { window.__app.run.s.hp = 0.01; });
  await page.waitForSelector('.results', { timeout: 8000 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `e2e-out/${name}-06-results.png` });
  const res = await page.evaluate(() => ({ why: document.querySelector('.why')?.textContent ?? '', score: document.getElementById('res-score')?.textContent, coins: window.__app.p.coins, runs: window.__app.p.totals.runs }));
  log(`  results: ${JSON.stringify(res)}`);
  check(res.why.length > 5, 'results explain why the run ended');
  check(res.runs >= 1, 'run was booked into the save');
  // saved to localStorage and survives reload
  await page.tap('text=홈으로'); await page.waitForSelector('.home');
  await page.reload(); await page.waitForSelector('.home');
  check(await app(() => window.__app.p.totals.runs >= 1 && window.__app.p.tutorialDone), 'progress survives a reload');

  // --- every menu screen opens without errors
  for (const [btn, sel, shot] of [['캐릭터', '.cards', '07-chars'], ['모험', '.worlds', '08-adventure'], ['오늘의 코스', '.bigstat', '09-daily'], ['미션', '.missions', '10-missions'], ['설정', '.set', '11-settings']]) {
    await page.tap(`.menu button:has-text("${btn}")`); await page.waitForSelector(sel, { timeout: 4000 });
    await page.screenshot({ path: `e2e-out/${name}-${shot}.png` });
    check(true, `${btn} screen opens`);
    await page.tap('.topbar .back'); await page.waitForSelector('.home');
  }
  // stage 1-1 from the map
  await page.tap('.menu button:has-text("모험")'); await page.waitForSelector('.stage');
  await page.tap('.stage >> nth=0'); await page.waitForSelector('.sheet');
  await page.tap('text=출발!'); await page.waitForSelector('#cv'); await page.waitForTimeout(2500);
  check(await app(() => window.__app.run?.s.mode === 'stage' && window.__app.run.s.phase === 'run'), 'stage run starts from the map');
  await page.screenshot({ path: `e2e-out/${name}-12-stage.png` });
  // background → auto pause
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200);
  check(await app(() => window.__app.run.paused), 'leaving the tab auto-pauses');

  log(`  network requests: ${requests.length}`);
  check(requests.length === 0, 'no network requests (fully offline)');
  log(`  console/page errors: ${errors.length}${errors.length ? '\n    ' + errors.join('\n    ') : ''}`);
  check(errors.length === 0, 'no console errors');
  await ctx.close();
}

await run('phone-portrait', { width: 390, height: 844 });
await run('small-portrait', { width: 360, height: 640 });
await run('phone-landscape', { width: 844, height: 390 });
await browser.close();
log(`\n${failures ? '❌ ' + failures + ' check(s) failed' : '✅ all checks passed'}`);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/e2e-report.txt', report.join('\n') + '\n');
process.exit(failures ? 1 : 0);
