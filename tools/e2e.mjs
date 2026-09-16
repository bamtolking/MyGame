/* Playwright smoke test on a phone-sized landscape viewport. Usage: node tools/e2e.mjs [url] */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = 'screenshots';
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const log = (...a) => console.log('[e2e]', ...a);
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/01-menu.png` });
// icons
for (const size of [192, 512]) {
  const png = await page.evaluate(async (size) => {
    const svg = await (await fetch('./icon.svg')).text();
    const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await new Promise((r) => (img.onload = r));
    const c = document.createElement('canvas'); c.width = size; c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/png');
  }, size);
  fs.writeFileSync(`public/icon-${size}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
log('icons written');
await page.getByText('빠른 대전').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/02-setup.png` });
await page.getByText('경기 시작').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${shots}/03-roster-open.png` });
// buy units via UI: select a shop card and tap cells
const cards = page.locator('.ucard');
log('shop cards', await cards.count());
await cards.nth(0).click();
const cells = page.locator('.cell');
await cells.nth(2 * 8 + 7).click();
await cells.nth(3 * 8 + 7).click();
await cards.nth(1).click();
await cells.nth(2 * 8 + 5).click();
await cells.nth(3 * 8 + 5).click();
await cells.nth(1 * 8 + 5).click();
await cards.nth(1).click(); // deselect
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/04-roster-bought.png` });
const rosterCount = await page.evaluate(() => window.lw.human.roster.filter(Boolean).length);
const credits = await page.evaluate(() => Math.floor(window.lw.human.credits));
log('roster count', rosterCount, 'credits', credits);
// cancel one (100% refund)
await cells.nth(1 * 8 + 5).click();
await page.locator('.rinfo .acts .btn.danger').click();
const credits2 = await page.evaluate(() => Math.floor(window.lw.human.credits));
log('after cancel credits', credits2);
// move one
await cells.nth(2 * 8 + 5).click();
await page.locator('.rinfo .acts .btn').first().click();
await cells.nth(4 * 8 + 4).click();
const moved = await page.evaluate(() => !!window.lw.human.roster[4 * 8 + 4]);
log('moved ok', moved);
await page.getByText('출격 준비 완료').click();
await page.waitForTimeout(3600);
await page.screenshot({ path: `${shots}/05-countdown-battle.png` });
// let battle run ~14s real-time
await page.waitForTimeout(14000);
await page.screenshot({ path: `${shots}/06-battle.png` });
const st = await page.evaluate(() => { const m = window.lw.match; return { t: m.s.t, units: m.s.units.length, fps: Math.round(window.lw.renderer.fps), simMs: window.lw.simMsPerTick.toFixed(3), phase: m.s.phase }; });
log('battle state', JSON.stringify(st));
// drag camera + pinch
await page.mouse.move(400, 200); await page.mouse.down(); await page.mouse.move(300, 220, { steps: 5 }); await page.mouse.up();
log('camera follow after drag:', await page.evaluate(() => window.lw.renderer.follow));
await page.getByText('전선').click();
log('camera follow after 전선:', await page.evaluate(() => window.lw.renderer.follow));
// panels
await page.getByText('상대').click(); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/07-enemy.png` });
await page.locator('.panel .close').click();
await page.getByText('연구').click(); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/08-research.png` });
await page.locator('.panel .close').click();
// pause
await page.locator('.botbar .btn').last().click(); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/09-pause.png` });
log('paused', await page.evaluate(() => window.lw.match.s.paused));
await page.getByText('계속하기').click();
log('paused after resume', await page.evaluate(() => window.lw.match.s.paused));
// save/restore round trip
const restored = await page.evaluate(() => { const m = window.lw.match; const json = m.serialize(); const M = m.constructor; const r = M.restore(json); return r ? { ok: true, units: r.s.units.length, same: r.serialize() === json } : { ok: false }; });
log('restore', JSON.stringify(restored));
// fast-forward to the end using the sim directly, then check the result screen
await page.evaluate(() => { const m = window.lw.match; let n = 0; while (!m.s.result && n++ < 20 * 60 * 16) m.step(); });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${shots}/10-result.png` });
log('result', await page.evaluate(() => JSON.stringify(window.lw.match.s.result)));
// portrait check
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/11-portrait.png` });
await page.setViewportSize({ width: 640, height: 360 });
await page.getByText('메뉴로').click();
await page.waitForTimeout(300);
await page.getByText('팀 전투').first().click();
await page.getByText('경기 시작').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}/12-team-640x360-roster.png` });
await page.locator('.panel .close').click();
await page.getByText('팀', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}/13-team-panel.png` });
await page.locator('.panel .close').click();
await page.getByText('출격 준비 완료').click();
await page.waitForTimeout(12000);
await page.screenshot({ path: `${shots}/14-team-battle.png` });
log('team state', await page.evaluate(() => { const m = window.lw.match; return JSON.stringify({ t: m.s.t, units: m.s.units.length, waves: m.s.players.map((p) => p.waveCount), fps: Math.round(window.lw.renderer.fps) }); }));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
