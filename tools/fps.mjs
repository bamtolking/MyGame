/* Browser render stress: start a match, inject N units, measure fps for ~6s. Headless Chromium with software GL (not a phone). */
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.getByText('팀 전투').first().click();
await page.getByText('경기 시작').click();
await page.waitForTimeout(500);
await page.locator('.panel .close').click();
for (const n of [0, 300, 600]) {
  const r = await page.evaluate(async (n) => {
    const lw = window.lw; const m = lw.match;
    m.s.phase = 'battle';
    const { unitDef, FACTIONS } = await import('/src/core/data/units.ts');
    const per = n / 2;
    for (let team = 0; team < 2; team++) for (let i = 0; i < per; i++) {
      const p = m.s.players[team * 3 + (i % 3)]; const units = FACTIONS[p.faction].units; const def = unitDef(units[i % units.length]);
      const x = team === 0 ? 900 + (i % 20) * 22 : 2400 - 900 - (i % 20) * 22; const y = 120 + Math.floor(i / 20) * 40 + (i % 3) * 10;
      m.spawnUnit(p, def, x, y, 0);
    }
    for (const p of m.s.players) p.interval = 9999;
    lw.renderer.jumpTo(1200, 500, 0.7);
    await new Promise((r) => setTimeout(r, 6000));
    return { units: m.s.units.length, fps: Math.round(lw.renderer.fps), simMs: lw.simMsPerTick.toFixed(2), quality: lw.renderer.quality };
  }, n);
  console.log(`inject ${n}:`, JSON.stringify(r));
  await page.screenshot({ path: `screenshots/stress-${n}.png` });
}
await browser.close();
