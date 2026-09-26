// Frame-cost check (GDD §13.7-10): headless Chromium, phone viewport, CPU throttled 4×, autopilot playing endless.
// Measures JS + canvas time spent inside App.frame per frame (p50/p95/max) and writes docs/perf-report.txt.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = 'file://' + resolve('play/index.html');
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });
const lines = [];
for (const [name, vp, throttle] of [['portrait-390x844', { width: 390, height: 844 }, 4], ['landscape-844x390', { width: 844, height: 390 }, 4], ['landscape-844x390-nothrottle', { width: 844, height: 390 }, 1]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jelly_runner_v1', JSON.stringify({ version: 2, tutorialDone: true, totals: { runs: 20 } })); });
  await page.reload();
  await page.waitForFunction(() => !!window.__app);
  await page.evaluate(() => {
    const a = window.__app; a.p.tutorialDone = true;
    window.__times = [];
    const f = a.frame.bind(a);
    a.frame = t => { const t0 = performance.now(); f(t); window.__times.push(performance.now() - t0); };
    a.startEndless();
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // simple in-page autopilot so the run keeps going with hazards/pickups/FX on screen
  await page.evaluate(() => {
    window.__auto = setInterval(() => {
      const a = window.__app; const s = a.run?.s; if (!s || s.phase !== 'run') return;
      const b = s.body; const h = s.level.hazards.find(h => !h.passed && !h.broken && h.x0 > b.x && h.x0 < b.x + 140);
      if (h) { if (h.kind === 'hang') a.input.keyDown('ArrowDown', false); else if (b.onGround || h.kind === 'tall') { a.input.keyUp('ArrowDown'); a.input.pressJump(); } }
      else a.input.keyUp('ArrowDown');
      if (s.hp < 40) s.hp = 80;   // keep it running for the measurement
    }, 50);
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__times = []; });
  await page.waitForTimeout(12000);
  const t = await page.evaluate(() => window.__times.slice());
  t.sort((a, b) => a - b);
  const q = p => t[Math.min(t.length - 1, Math.floor(p * t.length))] ?? 0;
  const line = `${name} (CPU ×${throttle}): frames=${t.length} p50=${q(0.5).toFixed(2)}ms p95=${q(0.95).toFixed(2)}ms max=${(t[t.length - 1] ?? 0).toFixed(2)}ms`;
  console.log(line); lines.push(line);
  await ctx.close();
}
await browser.close();
mkdirSync('docs', { recursive: true });
writeFileSync('docs/perf-report.txt', `# 프레임 비용 (App.frame 안의 JS+캔버스 시간, 헤드리스 Chromium, 소프트웨어 렌더)\n${lines.join('\n')}\n`);
