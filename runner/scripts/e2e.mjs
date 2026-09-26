// Real-browser test (GDD §13.7): headless Chromium with mobile viewports + touch, on the single-file build
// (play/index.html). Boots straight into 첫 달리기, checks the first tap (jump + AudioContext), browser-gesture
// blocking, multi-touch, the tutorial rewind hint, pause/auto-pause + 3-2-1 resume, a full stage 1-1 clear, the
// results input guard, instant retry timing, pad sizes, zero network requests, blocked localStorage and zero
// console errors. Screenshots → e2e-out/, log → docs/e2e-report.txt.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('e2e-out', { recursive: true });
const url = 'file://' + resolve('play/index.html');
const report = []; let failures = 0;
const log = m => { console.log(m); report.push(m); };
const check = (cond, msg) => { if (!cond) { failures++; log('  ✗ ' + msg); } else log('  ✓ ' + msg); return !!cond; };
// NOTE: no --autoplay-policy flag — audio must really be unlocked by the first gesture
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** in-page autopilot (keys / queued presses through the real InputState) */
const BOT = () => {
  clearInterval(window.__bot);
  window.__bot = setInterval(() => {
    const a = window.__app; const rc = a.run; const s = rc?.s;
    if (!s || s.phase !== 'run' || rc.paused || rc.resumeT > 0 || rc.ended) return;
    const b = s.body; const v = s.speed;
    const ahead = s.level.hazards.filter(h => !h.broken && h.x1 > b.x - 30 && h.x0 < b.x + 400);
    const hang = ahead.find(h => h.kind === 'hang' && h.y1 > 380 && h.x0 - b.x < 0.3 * v && h.x1 > b.x - 30);
    if (hang) a.input.keyDown('ArrowDown', false); else a.input.keyUp('ArrowDown');
    const low = ahead.some(h => h.kind === 'hang' && h.y1 <= 380 && h.x0 - b.x < 0.6 * v && h.x1 > b.x - 30);
    const next = ahead.filter(h => (h.kind === 'spike' || h.kind === 'tall') && h.x0 > b.x + 10).sort((p, q) => p.x0 - q.x0)[0];
    if (next && !low && !hang) {
      const d = next.x0 - b.x;
      const lead = next.kind === 'tall' ? 0.47 * v : 0.24 * v;
      if (b.onGround && d < lead && d > lead - 0.12 * v && !window.__botJ) { a.input.pressJump(); window.__botJ = 1; setTimeout(() => { window.__botJ = 0; }, 120); }
      if (next.kind === 'tall' && !b.onGround && b.jumps < 2 && b.vy > -160 && !window.__botJ2) { a.input.pressJump(); window.__botJ2 = 1; setTimeout(() => { window.__botJ2 = 0; }, 400); }
    }
    // pits: jump near the edge
    const gs = s.level.solids.filter(o => o.ground).sort((p, q) => p.x0 - q.x0);
    for (let i = 1; i < gs.length; i++) {
      const end = gs[i - 1].x1; if (gs[i].x0 - end < 2 || end < b.x) continue;
      const d = end - b.x; if (d < 0.14 * v && b.onGround && !window.__botJ && !hang) { a.input.pressJump(); window.__botJ = 1; setTimeout(() => { window.__botJ = 0; }, 150); }
      break;
    }
  }, 12);
};
const BOT_STOP = () => { clearInterval(window.__bot); window.__app?.input?.keyUp('ArrowDown'); };

async function zonePoints(page, portrait, vp) {
  if (portrait) return page.evaluate(() => { const c = el => { const r = document.querySelector(el).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }; return { jump: c('.pad.jump'), slide: c('.pad.slide') }; });
  return { jump: { x: vp.width * 0.22, y: vp.height * 0.6 }, slide: { x: vp.width * 0.78, y: vp.height * 0.6 } };
}

async function mobile(name, viewport, o = {}) {
  log(`\n## ${name} ${viewport.width}×${viewport.height}${o.blocked ? ' (localStorage blocked)' : ''}`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (o.blocked) await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); });
  const page = await ctx.newPage();
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  const app = (fn, arg) => page.evaluate(fn, arg);
  // (a screenshot can stall the page's frames for > 250 ms in software GL: the stall auto-pause must not see that)
  const shot = async n => { await page.evaluate(() => { if (window.__app) window.__app.stallMs = 1e9; }); await page.screenshot({ path: `e2e-out/${name}-${n}.png` }); await sleep(120); await page.evaluate(() => { if (window.__app) window.__app.stallMs = 250; }); };
  const portrait = viewport.height > viewport.width;
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

  // ---------------------------------------------------------------- boot → straight into 첫 달리기
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('#run #cv');
  check(Date.now() - t0 < 4000, `boots into the run (${Date.now() - t0} ms)`);
  check(await app(() => window.__app.run?.s.mode) === 'tutorial', 'first launch is the tutorial run (no menu first)');
  check(await page.isVisible('#title-ov') && (await page.textContent('#title-ov')).includes('야식 대질주'), 'translucent title overlay over the live run');
  check(await page.isVisible('#btn-skip'), "a small '건너뛰기' button");
  await sleep(700);
  await shot('01-boot');
  const Z = await zonePoints(page, portrait, viewport);
  if (portrait) {
    const pads = await app(() => ['.pad.jump', '.pad.slide'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }));
    const cv = await app(() => { const r = window.__app.renderer; return { w: r.cssW, h: r.worldH }; });
    log(`  pads ${JSON.stringify(pads)} · world ${cv.w}×${cv.h}`);
    check(pads.every(p => p.w >= 180 && p.h >= 120), 'portrait pads ≥ 180×120 CSS px');
    check(Math.abs(cv.w / cv.h - 16 / 9) < 0.03, 'portrait world view is 16:9');
  }

  // ---------------------------------------------------------------- first tap = jump + audio unlock
  const j0 = await app(() => window.__app.run.s.stats.jumps);
  await page.touchscreen.tap(Z.jump.x, Z.jump.y);
  await sleep(250);
  check(await app(() => window.__app.run.s.stats.jumps) > j0, 'the first tap jumps');
  const ac = await app(() => window.__app.audio.ctx?.state ?? 'none');
  check(ac === 'running', `AudioContext running after the first tap (${ac})`);
  check(await app(() => document.getElementById('title-ov')?.classList.contains('gone')), 'title overlay fades on the first press');
  await shot('02-first-tap');

  // ---------------------------------------------------------------- iOS double-tap-hold / long press: no selection, no menu, no zoom
  await app(() => { window.__cm = 0; window.addEventListener('contextmenu', e => { if (!e.defaultPrevented) window.__cm++; }); });
  const P = { x: Z.jump.x, y: Z.jump.y, id: 3 };
  await touch('touchStart', [P]); await sleep(40); await touch('touchEnd', []); await sleep(60);
  await touch('touchStart', [P]); await sleep(900); await touch('touchEnd', []);
  await sleep(100);
  const g = await app(() => ({ sel: String(window.getSelection?.() ?? ''), cm: window.__cm, zoom: window.visualViewport?.scale ?? 1 }));
  check(g.sel === '' && g.cm === 0 && g.zoom === 1, `double-tap-hold: no text selection / context menu / zoom (${JSON.stringify(g)})`);

  // ---------------------------------------------------------------- tutorial: a miss rewinds with a verb hint at 40 % speed
  await sleep(2500);    // stop tapping: the runner meets the first spike and the chunk rewinds
  const hint = await page.waitForFunction(() => !!window.__app.renderer?.hint, null, { timeout: 8000 }).then(() => true, () => false);
  if (check(hint, 'a tutorial miss shows a verb hint')) {
    const hv = await app(() => ({ text: window.__app.renderer.hint.text, flash: document.querySelectorAll('.pad.flash,.lh.flash').length, s0: window.__app.run.s.steps }));
    await sleep(500);
    const ds = await app(() => window.__app.run.s.steps) - hv.s0;
    log(`  hint "${hv.text}" · flashing ${hv.flash} · ${ds} steps in 0.5 s`);
    check(hv.flash > 0, 'the matching pad / thumb hint flashes');
    check(ds > 4 && ds < 20, 'rewind replays at ~40 % game speed');
    await shot('03-tutorial-hint');
  }

  // ---------------------------------------------------------------- pause (button) → sheet; resume needs 계속 + 3-2-1
  await page.tap('#btn-pause'); await sleep(150);
  const ps = await app(() => window.__app.run.s.steps); await sleep(500);
  check(await app(() => window.__app.run.paused) && await app(() => window.__app.run.s.steps) === ps, 'pause freezes the sim');
  const sheet = await page.textContent('#modal .sheet');
  check(/계속/.test(sheet) && /처음부터/.test(sheet) && /음악/.test(sheet) && /효과음/.test(sheet) && /흔들림/.test(sheet), 'pause sheet: 계속 · 처음부터 · quick settings');
  await shot('04-pause');
  await page.tap('#btn-resume'); await sleep(700);
  check(await app(() => window.__app.run.s.steps) === ps, 'still held during the 3-2-1');
  await shot('05-resume-count');
  await sleep(1200);
  check(await app(() => window.__app.run.s.steps) > ps, 'runs again after the countdown');

  // ---------------------------------------------------------------- finish the tutorial (autopilot) or skip it → 잘했어요 → 1-1
  if (o.playTutorial) {
    await page.evaluate(BOT);
    const done = await page.waitForFunction(() => !!document.getElementById('cheer') || window.__app.run?.s.mode === 'stage', null, { timeout: 60000 }).then(() => true, () => false);
    const rw = await app(() => window.__app.run?.s.rewinds ?? -1);
    check(done, `the tutorial clears by playing it (rewinds: ${rw})`);
    await shot('06-cheer');
    await page.evaluate(BOT_STOP);
  } else {
    await page.tap('#btn-skip');
    await page.waitForSelector('#cheer', { timeout: 3000 }).catch(() => {});
    await shot('06-cheer');
  }
  const st = await page.waitForFunction(() => window.__app.run?.s.mode === 'stage' && window.__app.run.s.stageId === '1-1', null, { timeout: 5000 }).then(() => true, () => false);
  check(st, 'then stage 1-1 starts right away');
  check(await app(() => window.__app.p.tutorialDone), 'tutorial completion is saved');

  // ---------------------------------------------------------------- multi-touch: hold slide + tap jump → jumps
  await sleep(300);
  const Z2 = await zonePoints(page, portrait, viewport);
  const mj = await app(() => window.__app.run.s.stats.jumps);
  await touch('touchStart', [{ x: Z2.slide.x, y: Z2.slide.y, id: 11 }]); await sleep(200);
  const sl = await app(() => window.__app.input.slideHeld && window.__app.run.s.body.sliding);
  await touch('touchStart', [{ x: Z2.slide.x, y: Z2.slide.y, id: 11 }, { x: Z2.jump.x, y: Z2.jump.y, id: 12 }]); await sleep(60);
  await touch('touchEnd', [{ x: Z2.jump.x, y: Z2.jump.y, id: 12 }]); await sleep(150);   // CDP: the listed point is the one released
  const still = await app(() => window.__app.input.slideHeld);
  await touch('touchEnd', []); await sleep(100);
  check(sl, 'holding the slide zone slides');
  check(await app(() => window.__app.run.s.stats.jumps) > mj && still, 'multi-touch: slide held + jump tap → jumps, slide stays held');

  // ---------------------------------------------------------------- auto-pause on visibilitychange; resume only by 계속 + countdown
  await app(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(150);
  const vs = await app(() => window.__app.run.s.steps);
  await app(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(700);
  check(await app(() => window.__app.run.paused) && await app(() => window.__app.run.s.steps) === vs, 'hiding the page auto-pauses; coming back does not resume by itself');
  await page.tap('#btn-resume'); await sleep(600);
  check(await app(() => window.__app.run.s.steps) === vs, 'countdown after 계속');
  await sleep(1300);
  check(await app(() => window.__app.run.s.steps) > vs, 'resumes after the countdown');

  // ---------------------------------------------------------------- a > 250 ms hitch auto-pauses (no burst of catch-up steps)
  await sleep(1200);
  const hs = await app(() => { const s0 = window.__app.run.s.steps; const t = performance.now(); while (performance.now() - t < 420) { /* block the main thread */ } return s0; });
  await sleep(250);
  const hp = await app(() => ({ paused: window.__app.run.paused, steps: window.__app.run.s.steps }));
  check(hp.paused && hp.steps - hs <= 5, `a 420 ms stall auto-pauses (${hp.steps - hs} steps ran)`);
  await page.tap('#btn-resume'); await sleep(1800);

  // ---------------------------------------------------------------- a full stage 1-1 run (autopilot) → clear → results
  if (o.fullStage) {
    await page.evaluate(BOT);
    const clear = await page.waitForFunction(() => window.__app.run?.s.phase === 'clear' || window.__app.run?.s.phase === 'over', null, { timeout: 70000, polling: 200 }).then(() => true, () => false);
    await page.evaluate(BOT_STOP);
    const r = await app(() => { const s = window.__app.run.s; return { phase: s.phase, dist: Math.floor(s.dist), hits: s.stats.hits, jellies: s.stats.jellies, fps: Math.round(window.__app.fps) }; });
    log(`  stage 1-1: ${JSON.stringify(r)}`);
    check(clear && r.phase === 'clear', 'stage 1-1 played to the finish flag');
    await page.waitForSelector('#results', { timeout: 4000 }).catch(() => {});
    await sleep(1200);
    await shot('07-stage-clear');
    check(await app(() => ((window.__app.p.starMask['1-1'] ?? 0) & 1) === 1), '★1 booked for 1-1');
    check(await page.isVisible('#results .res-stars'), 'stage clear shows the stars');
    await sleep(100);
    await page.tap('#res-retry');
    check(await page.waitForFunction(() => window.__app.run?.s.stageId === '1-1' && window.__app.run.s.phase === 'run' && !document.getElementById('results'), null, { timeout: 3000 }).then(() => true, () => false), '다시 달리기 → the stage again, no countdown');
  }

  // ---------------------------------------------------------------- KO: mashing does not skip the results; results fit, no scroll
  await sleep(600);
  const R = await zonePoints(page, portrait, viewport);
  await app(() => { const s = window.__app.run.s; s.lastHit = { kind: 'spike', biome: s.biome, x: s.body.x + 10 }; s.hurtT = 0; s.stats.hits += 2; s.stats.hitsBy.spike = 2; s.hp = 0.001; });
  let seen = 0; const m0 = Date.now();
  while (Date.now() - m0 < 3000) {
    await page.touchscreen.tap(portrait ? R.jump.x : viewport.width * 0.85, viewport.height - 60).catch(() => {});
    if (!seen && await page.$('#results')) seen = Date.now();
    if (seen && Date.now() - seen > 220) break;
    await sleep(40);
  }
  await sleep(900);
  const guard = await app(() => ({ res: !!document.getElementById('results'), phase: window.__app.run?.s.phase }));
  check(!!seen && guard.res && guard.phase === 'over', `mashing at the KO does not skip the results (${JSON.stringify(guard)})`);
  const fit = await app(() => { const m = document.querySelector('#results .res-main'); const r = document.getElementById('results').getBoundingClientRect(); return { sh: m.scrollHeight, ch: m.clientHeight, docH: document.documentElement.scrollHeight, vh: innerHeight, bottom: Math.round(r.bottom) }; });
  check(fit.sh <= fit.ch + 1 && fit.docH <= fit.vh + 1, `results fit one screen without scrolling (${JSON.stringify(fit)})`);
  const ko = await page.textContent('#results .res-ko');
  check(/—/.test(ko ?? ''), `쓰러짐 card names the hazard + its verb ("${(ko ?? '').trim().slice(0, 30)}")`);
  check(!!(await page.$('#results .res-ledger')) && !!(await page.$('#results .res-break')), '따끈함 장부 + 점수 내역 shown');
  await shot('08-results');
  const rb = await app(() => { const r = document.getElementById('res-retry').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, area: r.width * r.height, home: (() => { const q = document.getElementById('res-home').getBoundingClientRect(); return q.width * q.height; })() }; });
  check(rb.area > rb.home, '다시 달리기 is the biggest button');
  if (portrait) check(Math.abs(rb.x - Z.jump.x) < viewport.width * 0.25 && rb.y > viewport.height * 0.6, '다시 달리기 sits where the jump pad was');
  else check(rb.x > viewport.width * 0.6 && rb.y > viewport.height * 0.5, '다시 달리기 sits under the right thumb');

  // ---------------------------------------------------------------- instant retry: death → controllable ≤ 2.5 s (incl. the 0.8 s KO)
  await page.tap('#res-retry');
  await page.waitForFunction(() => window.__app.run?.s.phase === 'run' && !document.getElementById('results'), null, { timeout: 3000 });
  await sleep(300);
  const T = await zonePoints(page, portrait, viewport);
  await app(() => { window.__koT = performance.now(); window.__app.run.s.hp = 0.001; });
  await page.waitForSelector('#results', { timeout: 4000 });
  await page.waitForFunction(() => performance.now() - window.__koT > 0 && document.getElementById('results') && performance.now() >= (window.__app.run.results?.readyAt ?? 0), null, { polling: 16 });
  const rr = await app(() => { const r = document.getElementById('res-retry').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(rr.x, rr.y);
  await page.waitForFunction(() => window.__app.run?.s.phase === 'run' && !document.getElementById('results'), null, { timeout: 3000, polling: 16 });
  const jBefore = await app(() => window.__app.run.s.stats.jumps);
  await page.touchscreen.tap(T.jump.x, T.jump.y);
  await page.waitForFunction(j => window.__app.run.s.stats.jumps > j, jBefore, { timeout: 2000, polling: 16 }).catch(() => {});
  const dt = await app(() => Math.round(performance.now() - window.__koT));
  check(dt <= 2500, `death → retry → jump in ${dt} ms (≤ 2500)`);

  // ---------------------------------------------------------------- holding jump 0.4 s on the results also retries
  await app(() => { window.__app.run.s.hp = 0.001; });
  await page.waitForSelector('#results', { timeout: 4000 }); await sleep(450);
  const run0 = await app(() => window.__app.run.s.seed + ':' + window.__app.run.s.steps);
  const H = portrait ? { x: rr.x, y: viewport.height * 0.35 } : { x: viewport.width * 0.2, y: viewport.height * 0.2 };
  await touch('touchStart', [{ x: H.x, y: H.y, id: 21 }]); await sleep(600); await touch('touchEnd', []);
  await sleep(200);
  check(await app(r => !document.getElementById('results') && window.__app.run.s.phase === 'run' && (window.__app.run.s.seed + ':' + window.__app.run.s.steps) !== r, run0), 'holding the jump zone 0.4 s on the results retries');

  // ---------------------------------------------------------------- 홈 leaves the run
  await app(() => { window.__app.run.s.hp = 0.001; });
  await page.waitForSelector('#results', { timeout: 4000 }); await sleep(450);
  await page.tap('#res-home');
  const home = await page.waitForFunction(() => !document.getElementById('run') && window.__app.screen !== 'run' && !window.__app.run, null, { timeout: 3000 }).then(() => true, () => false);
  check(home, '홈 leaves the run (rAF stopped, menus shown)');
  await sleep(500);
  await shot('09-home');

  log(`  network requests: ${requests.length}${requests.length ? ' ' + requests.slice(0, 3).join(' ') : ''}`);
  check(requests.length === 0, 'no network requests (fully offline)');
  log(`  console/page errors: ${errors.length}${errors.length ? '\n    ' + errors.join('\n    ') : ''}`);
  check(errors.length === 0, 'no console errors');
  await ctx.close();
}

async function desktop(name, viewport) {
  log(`\n## ${name} ${viewport.width}×${viewport.height} (mouse + keyboard)`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; const requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  const app = (fn, arg) => page.evaluate(fn, arg);
  const shot = async n => { await page.evaluate(() => { if (window.__app) window.__app.stallMs = 1e9; }); await page.screenshot({ path: `e2e-out/${name}-${n}.png` }); await sleep(120); await page.evaluate(() => { if (window.__app) window.__app.stallMs = 250; }); };
  await page.goto(url);
  await page.waitForSelector('#run #cv'); await sleep(500);
  check(await app(() => window.__app.run?.s.mode) === 'tutorial', 'boots into the tutorial');
  const j0 = await app(() => window.__app.run.s.stats.jumps);
  await page.keyboard.press('Space'); await sleep(200);
  check(await app(() => window.__app.run.s.stats.jumps) > j0, 'Space jumps');
  check(await app(() => window.__app.audio.ctx?.state) === 'running', 'AudioContext running after the first key');
  await page.mouse.click(viewport.width * 0.25, viewport.height * 0.5); await sleep(200);
  check(await app(() => window.__app.run.s.stats.jumps) > j0 + 1, 'mouse click on the left half jumps');
  await shot('01-boot');
  await page.click('#btn-skip');
  await page.waitForFunction(() => window.__app.run?.s.mode === 'stage', null, { timeout: 5000 });
  await sleep(400);
  await page.keyboard.down('ArrowDown'); await sleep(200);
  check(await app(() => window.__app.run.s.body.sliding), 'ArrowDown held slides');
  await page.keyboard.up('ArrowDown');
  // right-click never opens a menu
  await app(() => { window.__cm = 0; window.addEventListener('contextmenu', e => { if (!e.defaultPrevented) window.__cm++; }); });
  await page.mouse.click(viewport.width * 0.7, viewport.height * 0.5, { button: 'right' });
  check(await app(() => window.__cm) === 0, 'right-click context menu is blocked');
  await page.keyboard.press('Escape'); await sleep(200);
  check(await app(() => window.__app.run.paused), 'Esc pauses');
  await page.keyboard.press('Escape'); await sleep(1900);
  check(await app(() => !window.__app.run.paused && window.__app.run.s.phase === 'run'), 'Esc resumes (after the countdown)');
  await page.evaluate(BOT); await sleep(6000); await page.evaluate(BOT_STOP);
  await shot('02-stage');
  await app(() => { window.__app.run.s.hp = 0.001; });
  await page.waitForFunction(() => !!document.getElementById('results'), null, { timeout: 4000, polling: 10 });
  const early = await app(() => Math.round((window.__app.run.results?.readyAt ?? 0) - performance.now()));
  await page.keyboard.press('Enter');     // inside the 0.35 s guard: ignored
  await sleep(150);
  check(early <= 0 || !!(await page.$('#results')), `Enter during the input guard is ignored (${early} ms before ready)`);
  await sleep(500);
  await shot('03-results');
  await page.keyboard.press('Enter'); await sleep(300);
  check(await app(() => !document.getElementById('results') && window.__app.run?.s.phase === 'run'), 'Enter retries on the results');
  log(`  fps ${await app(() => Math.round(window.__app.fps))}`);
  check(requests.length === 0, 'no network requests');
  log(`  console/page errors: ${errors.length}${errors.length ? '\n    ' + errors.join('\n    ') : ''}`);
  check(errors.length === 0, 'no console errors');
  await ctx.close();
}

await mobile('phone-portrait', { width: 390, height: 844 }, { playTutorial: true, fullStage: true });
await mobile('small-portrait', { width: 360, height: 640 }, {});
await mobile('phone-landscape', { width: 844, height: 390 }, { fullStage: true });
await desktop('desktop', { width: 1280, height: 720 });
await mobile('no-storage', { width: 390, height: 844 }, { blocked: true });
await browser.close();
log(`\n${failures ? '❌ ' + failures + ' check(s) failed' : '✅ all checks passed'}`);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/e2e-report.txt', `e2e (${new Date().toISOString()}) — play/index.html in headless Chromium\n` + report.join('\n') + '\n');
process.exit(failures ? 1 : 0);
