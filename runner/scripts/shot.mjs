// Quick visual check: open the single-file build in headless Chromium at phone sizes and screenshot key screens.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.argv[2] || 'e2e-out/shots';
mkdirSync(out, { recursive: true });
const url = 'file://' + resolve('play/index.html');
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const [name, vp] of [['land', { width: 844, height: 390 }], ['port', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('.home');
  await page.screenshot({ path: `${out}/${name}-home.png` });
  // start endless directly (skip tutorial) through the app object
  await page.evaluate(() => { const a = window.__app; a.p.tutorialDone = true; a.startEndless(); });
  await page.waitForTimeout(2300);
  // simple autopilot: jump periodically, slide sometimes
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(220); }
  await page.screenshot({ path: `${out}/${name}-run.png` });
  const st = await page.evaluate(() => { const s = window.__app.run?.s; return s ? { phase: s.phase, dist: Math.floor(s.dist), hp: Math.round(s.hp), score: s.score, fps: Math.round(window.__app.fps) } : null; });
  console.log(name, JSON.stringify(st));
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
