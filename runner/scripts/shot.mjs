// Quick visual check: open the single-file build in headless Chromium at phone/desktop sizes and screenshot the
// boot (title + first run), a run with HUD, the pause sheet and the results. Usage: node scripts/shot.mjs [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.argv[2] || 'e2e-out/shots';
mkdirSync(out, { recursive: true });
const url = 'file://' + resolve('play/index.html');
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });
const errors = [];
const sizes = [['land', { width: 844, height: 390 }], ['port', { width: 390, height: 844 }], ['small', { width: 360, height: 640 }], ['desk', { width: 1280, height: 720 }]];
for (const [name, vp] of sizes) {
  const mobile = name !== 'desk';
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#cv');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-1-boot.png` });
  // endless run with a fixed seed, a little autopilot
  await page.evaluate(() => { const a = window.__app; a.p.tutorialDone = true; a.p.bestEndless = { score: 3000, dist: 420, charId: 'hotteok', date: 0, assist: false, relay: false, scoreVersion: 1 }; a.startRun({ mode: 'endless', seed: 7, charId: 'hotteok', companionId: 'firefly', noCountdown: true }); });
  await page.evaluate(() => {
    window.__auto = setInterval(() => {
      const a = window.__app; const s = a.run?.s; if (!s || s.phase !== 'run') return;
      const b = s.body; const h = s.level.hazards.find(h => !h.passed && !h.broken && h.x1 > b.x - 20 && h.x0 < b.x + 150);
      if (h && h.kind === 'hang' && h.y1 > 380) a.input.keyDown('ArrowDown', false); else a.input.keyUp('ArrowDown');
      if (h && h.kind !== 'hang' && b.onGround && h.x0 > b.x) a.input.pressJump();
      if (h && h.kind === 'tall' && !b.onGround && b.vy > -200 && b.jumps < 2) a.input.pressJump();
      const pit = s.level.solids.every(o => !(o.ground && o.x0 <= b.x + 60 && o.x1 >= b.x + 60)); if (pit && b.onGround) a.input.pressJump();
    }, 30);
  });
  await page.waitForTimeout(6000);
  await page.evaluate(() => { const s = window.__app.run.s; s.hp = s.maxHp * 0.15; s.letters = [true, true, false, true, false]; s.streak = 23; s.power.magnet = 4; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-2-run.png` });
  const st = await page.evaluate(() => { const s = window.__app.run?.s; return s ? { phase: s.phase, dist: Math.floor(s.dist), hp: Math.round(s.hp), score: s.score, fps: Math.round(window.__app.fps) } : null; });
  console.log(name, JSON.stringify(st));
  await page.evaluate(() => window.__app.setPaused(true));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-3-pause.png` });
  await page.evaluate(() => { window.__app.closeModal(); window.__app.setPaused(false); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}-4-resume.png` });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { clearInterval(window.__auto); const s = window.__app.run.s; s.stats.hits = 3; s.stats.hitsBy = { spike: 2, hang: 1 }; s.lastHit = { kind: 'spike', biome: 'market', x: s.body.x }; s.hurtT = 0; s.hp = 0.01; });
  await page.waitForSelector('#results', { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}-5-results.png` });
  const fit = await page.evaluate(() => { const m = document.querySelector('.res-main'); return m ? { sh: m.scrollHeight, ch: m.clientHeight } : null; });
  console.log(name, 'results fit', JSON.stringify(fit));
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
