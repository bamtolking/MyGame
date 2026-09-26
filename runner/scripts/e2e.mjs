// Real-browser test (GDD §13.7): headless Chromium with mobile viewports + touch, on the single-file build
// (play/index.html). Boots straight into 첫 달리기, checks the first tap (jump + AudioContext), browser-gesture
// blocking, multi-touch (game zones AND ⏸ / 계속 / 다시 달리기 with the other thumb down), the tutorial rewind hint,
// pause/auto-pause + 3-2-1 resume, a full stage 1-1 clear, the ghost lined up on GO, the results input guard and
// unbroken score numbers, instant retry timing, pad sizes, the back button / edge swipe, 16:9 landscape thumb hints,
// the render cap, zero network requests, blocked localStorage and zero console errors.
// Screenshots → e2e-out/, log → docs/e2e-report.txt.
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
const centerOf = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
/** 점수 내역 chips whose number wraps (e.g. "43,6 / 14") or whose label is cut */
const BROKEN_CHIPS = () => Array.from(document.querySelectorAll('#results .res-break span')).filter(sp => sp.offsetParent).filter(sp => {
  const b = sp.querySelector('b'), sm = sp.querySelector('small');
  return b.getBoundingClientRect().height > parseFloat(getComputedStyle(b).fontSize) * 1.8 || sm.scrollWidth > sm.clientWidth + 1;
}).map(sp => sp.textContent);

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
  await page.tap('#modal .sheet h3'); await sleep(250);
  check(await app(() => window.__app.audio.ctx?.state) === 'suspended', 'touching the pause sheet does not bring the sound back');
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
  // ⏸ and 계속 with the other thumb still on the glass (a second finger makes the browser drop the click)
  await touch('touchStart', [{ x: Z2.slide.x, y: Z2.slide.y, id: 13 }]); await sleep(150);
  const PB = await centerOf(page, '#btn-pause');
  await touch('touchStart', [{ x: Z2.slide.x, y: Z2.slide.y, id: 13 }, { ...PB, id: 14 }]); await sleep(60);
  await touch('touchEnd', [{ ...PB, id: 14 }]); await sleep(200);
  check(await app(() => window.__app.run.paused), 'multi-touch: ⏸ pauses while the other thumb holds slide');
  const RB = await centerOf(page, '#btn-resume');
  await touch('touchStart', [{ x: Z2.slide.x, y: Z2.slide.y, id: 13 }, { ...RB, id: 15 }]); await sleep(60);
  await touch('touchEnd', [{ ...RB, id: 15 }]); await sleep(150);
  check(await app(() => !window.__app.run.paused && window.__app.run.resumeT > 0), 'multi-touch: 계속 resumes with a finger resting on the sheet');
  await touch('touchEnd', []); await sleep(1700);

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
    check(await app(() => !!window.__app.run.ghost), 'the 1-1 clear races along as a ghost');
    // recorded on an instant retry (no 3-2-1), raced from the stage card (with one): the ghost waits for GO
    await app(() => window.__app.startStage('1-1'));
    await sleep(700);
    const gc = await app(() => { const rc = window.__app.run; return { phase: rc.s.phase, ghost: !!rc.ghost, gx: rc.ghost?.s.body.x, x: rc.s.body.x }; });
    await page.waitForFunction(() => window.__app.run.s.phase === 'run' && window.__app.run.s.t > 0.4, null, { timeout: 4000, polling: 16 });
    const gr = await app(() => { const rc = window.__app.run; return { t: rc.s.t, gt: rc.ghost?.s.t, x: rc.s.body.x, gx: rc.ghost?.s.body.x }; });
    log(`  ghost: countdown ${JSON.stringify(gc)} · after GO ${JSON.stringify(gr)}`);
    check(gc.phase === 'countdown' && gc.ghost && gc.gx === gc.x && gr.gt === gr.t && gr.gx === gr.x, 'the ghost waits out the 3-2-1 and leaves with the player on GO');
    await app(() => window.__app.retry());
    await page.waitForFunction(() => window.__app.run?.s.phase === 'run', null, { timeout: 3000 });
  }

  // ---------------------------------------------------------------- KO: mashing does not skip the results; results fit, no scroll
  await sleep(600);
  const R = await zonePoints(page, portrait, viewport);
  await app(() => {
    const s = window.__app.run.s; s.lastHit = { kind: 'spike', biome: s.biome, x: s.body.x + 10 }; s.hurtT = 0; s.stats.hits += 2; s.stats.hitsBy.spike = 2; s.hp = 0.001;
    // a long run's breakdown: 5–6 digit values must never break mid-number
    s.score += 120000; Object.assign(s.stats, { jellies: 1400, jelliesSeen: Math.max(s.stats.jelliesSeen, 1600), bigJellies: 62, lines: 20, nearMisses: 41, bonusJellies: 300, moonCakes: 5, letters: 10, smashed: 3 });
  });
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
  const broken = await app(BROKEN_CHIPS);
  check(broken.length === 0, `점수 내역: no number breaks mid-value, no label is cut${broken.length ? ' (' + broken.join(' | ') + ')' : ''}`);
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

  // ---------------------------------------------------------------- 다시 달리기 while the slide thumb is still down from the run
  await sleep(300);
  await touch('touchStart', [{ x: T.slide.x, y: T.slide.y, id: 31 }]); await sleep(100);
  await app(() => { window.__app.run.s.hp = 0.001; });
  await page.waitForSelector('#results', { timeout: 4000 }); await sleep(450);
  const RR = await centerOf(page, '#res-retry');
  await touch('touchStart', [{ x: T.slide.x, y: T.slide.y, id: 31 }, { ...RR, id: 32 }]); await sleep(60);
  await touch('touchEnd', [{ ...RR, id: 32 }]); await sleep(250);
  check(await app(() => !document.getElementById('results') && window.__app.run?.s.phase === 'run'), 'multi-touch: 다시 달리기 works while the slide thumb is still down');
  await touch('touchEnd', []); await sleep(200);

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
  // render cap: 60 fps whatever the panel's refresh (synthetic vsync timestamps into App.frame, sim held)
  const pace = await app(() => {
    const a = window.__app; const rc = a.run; const r = a.renderer; const draw = r.draw; let n = 0; const out = {};
    a.stopLoop(); a.stallMs = 1e9; rc.paused = true; r.draw = function (...x) { n++; return draw.apply(this, x); };
    for (const hz of [60, 75, 90, 120, 144]) { n = 0; rc.lastT = 0; const t0 = performance.now(); for (let i = 0; i < hz * 2; i++) a.frame(t0 + i * 1000 / hz); out[hz + 'Hz'] = Math.round(n / 2); }
    r.draw = draw; rc.paused = false; rc.lastT = 0; a.startLoop(); return out;
  });
  await sleep(300); await app(() => { window.__app.stallMs = 250; });   // (that blocked the page ~2 s: no stall pause for it)
  check(Object.values(pace).every(v => v >= 58 && v <= 62), `render cap: ~60 fps on 60–144 Hz panels (${JSON.stringify(pace)})`);
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
  // 골목 지도: a remix locked with enough stars names the stage still to reach
  const remix = await app(() => { const a = window.__app; for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) { a.p.starMask[id] = 7; a.p.pouches[id] = 7; } a.showAdventure(); return document.querySelector('[data-stage="1-R"] .node-need')?.textContent ?? ''; });
  check(/1-6 도착/.test(remix), `a locked remix with ★12 shows its real blocker ("${remix}")`);
  check(requests.length === 0, 'no network requests');
  log(`  console/page errors: ${errors.length}${errors.length ? '\n    ' + errors.join('\n    ') : ''}`);
  check(errors.length === 0, 'no console errors');
  await ctx.close();
}

/** Android back / edge swipe: one history guard keeps the player inside the game (and a 첫 달리기 replay ends in 설정) */
async function backButton(name, viewport) {
  log(`\n## ${name} ${viewport.width}×${viewport.height} (back button, 첫 달리기 replay)`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const app = (fn, arg) => page.evaluate(fn, arg);
  await page.goto('data:text/html,<title>before</title>before');
  await page.goto(url); await page.waitForSelector('#run #cv'); await sleep(400);
  const here = () => page.evaluate(() => location.protocol === 'file:' && !!window.__app).catch(() => false);
  const back = async () => { await page.evaluate(() => history.back()); await sleep(450); };
  const Z = await zonePoints(page, true, viewport);
  await page.touchscreen.tap(Z.jump.x, Z.jump.y); await sleep(250);      // the first tap (a gesture) arms the guard
  await back();
  check(await here() && await app(() => window.__app.run?.paused === true), 'back during the first run pauses it — the page stays');
  await back();
  check(await here() && await app(() => window.__app.run?.paused === true && !!document.querySelector('#modal .pause')), 'back again keeps the pause sheet');
  await page.tap('#btn-quit');                                          // 건너뛰기 → 1-1
  await page.waitForFunction(() => window.__app.run?.s.mode === 'stage' && window.__app.run.s.phase === 'run', null, { timeout: 5000 });
  await app(() => { window.__app.run.s.hp = 0.001; });
  await page.waitForSelector('#results', { timeout: 4000 }); await sleep(500);
  await back();
  check(await here() && await app(() => window.__app.screen === 'home' && !window.__app.run), 'back on the results → 홈');
  await page.tap('#btn-map'); await sleep(300);
  await page.tap('[data-stage="1-1"]'); await sleep(300);
  await back();
  check(await here() && await app(() => window.__app.screen === 'adventure' && !document.getElementById('modal')), 'back closes the stage card');
  await back();
  check(await here() && await app(() => window.__app.screen === 'home'), 'back on 골목 지도 → 홈');
  // 첫 달리기 replayed from 설정 comes back to 설정 (not into 1-1)
  await page.tap('#nav-settings'); await sleep(300);
  await page.tap('#set-tutorial');
  await page.waitForFunction(() => window.__app.run?.s.mode === 'tutorial', null, { timeout: 3000 });
  await sleep(300);
  await page.tap('#btn-pause'); await sleep(200);
  const quit = await page.textContent('#btn-quit');
  await page.tap('#btn-resume'); await sleep(300);
  await page.tap('#btn-skip');
  const toSettings = await page.waitForFunction(() => window.__app.screen === 'settings' && !window.__app.run, null, { timeout: 4000 }).then(() => true, () => false);
  check(quit === '그만하기' && toSettings, `a 첫 달리기 replay offers 그만하기 and ends back in 설정 (${quit})`);
  await back();
  check(await here() && await app(() => window.__app.screen === 'home' && !history.state?.yasik), 'back on 설정 → 홈, no guard left');
  await page.evaluate(() => history.back());
  const left = await page.waitForURL(/^data:/, { timeout: 3000 }).then(() => true, () => false);
  check(left, 'back on 홈 leaves the game');
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/** 16:9 landscape (no letterbox): thumb hints drop into the ground band; 좌우 바꾸기 turns the tutorial signs round */
async function hints169(name, viewport) {
  log(`\n## ${name} ${viewport.width}×${viewport.height} (thumb hints, swapped tutorial)`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const app = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(url); await page.waitForSelector('#run #cv');
  await app(() => { const a = window.__app; a.p.settings.swapSides = true; a.startTutorial(); });
  await sleep(300);
  const r = await app(() => new Promise(res => {
    const a = window.__app; const c = document.getElementById('cv').getContext('2d'); const signs = new Set(); const f = c.fillText;
    c.fillText = function (t, ...x) { if (/점프!|슬라이드!/.test(t)) signs.add(t); return f.call(this, t, ...x); };
    setTimeout(() => {
      c.fillText = f;
      const gy = a.renderer.sy(440); const vis = el => getComputedStyle(el).display !== 'none';
      const lh = ['.lh.jump', '.lh.slide'].map(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect(); return { s, vis: vis(el), top: Math.round(b.top), left: Math.round(b.left) }; });
      res({ signs: [...signs], gy: Math.round(gy), lh, inband: document.getElementById('lhints').classList.contains('inband') });
    }, 1500);
  }));
  log(`  ${JSON.stringify(r)}`);
  const [j, sl] = r.lh;
  check(r.inband && j.vis && j.top >= r.gy - 1, 'no letterbox: the thumb hints sit in the ground band, off the play band');
  check(!sl.vis && j.left > viewport.width / 2, 'tutorial: before the slide beat only the (swapped, right) 점프 hint shows');
  check(r.signs.some(t => /점프! \(오른쪽/.test(t)), 'tutorial signs follow 좌우 바꾸기 (「점프! (오른쪽/…)」)');
  await page.screenshot({ path: `e2e-out/${name}-01-hints.png` });
  await ctx.close();
}

await mobile('phone-portrait', { width: 390, height: 844 }, { playTutorial: true, fullStage: true });
await mobile('small-portrait', { width: 360, height: 640 }, {});
await mobile('phone-landscape', { width: 844, height: 390 }, { fullStage: true });
await desktop('desktop', { width: 1280, height: 720 });
await mobile('no-storage', { width: 390, height: 844 }, { blocked: true });
await backButton('back-button', { width: 390, height: 844 });
await hints169('landscape-16x9', { width: 640, height: 360 });
await browser.close();
log(`\n${failures ? '❌ ' + failures + ' check(s) failed' : '✅ all checks passed'}`);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/e2e-report.txt', `e2e (${new Date().toISOString()}) — play/index.html in headless Chromium\n` + report.join('\n') + '\n');
process.exit(failures ? 1 : 0);
